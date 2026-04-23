import { WebSocketServer, WebSocket, RawData } from "ws";
import { EventEmitter } from "events";
import { Server } from "http";
import { IncomingMessage } from "http";
import { WebSocketMessage, WebSocketMessageFactory } from "../models/Events";
import { TokenValidator } from "./TokenValidator";
import { Buffer } from "buffer";

interface Client {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  namespaceFilter?: string[];
  lastActivity: Date;
  authenticated: boolean;
  backpressureLoggedAt?: number;
}

// Broadcast is skipped for clients whose outgoing buffer exceeds this ceiling so a slow
// client can't back up the server. On recovery the next broadcast resumes.
const BACKPRESSURE_BYTES = 4 * 1024 * 1024;
// Per-IP token bucket: 10 connections / 60s rolling window.
const CONNECT_RATE_LIMIT = 10;
const CONNECT_RATE_WINDOW_MS = 60_000;

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, Client>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs: number;
  private heartbeatTimeoutMs: number; // Keeping for potential future use
  private tokenValidator: TokenValidator | null;
  private recentConnectsByIp: Map<string, number[]> = new Map();

  constructor(
    server: Server,
    heartbeatIntervalMs: number = 30000,
    heartbeatTimeoutMs: number = 10000,
    tokenValidator: TokenValidator | null = null,
  ) {
    super();
    this.clients = new Map();
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
    this.tokenValidator = tokenValidator;

    this.wss = new WebSocketServer({
      server,
      path: "/ws",
      // Initial-state messages carry all cluster nodes and chunked pods; 8MB gives
      // headroom for large clusters while still bounding worst-case memory.
      maxPayload: 8 * 1024 * 1024,
      perMessageDeflate: {
        threshold: 1024,
        zlibDeflateOptions: { level: 6 },
      },
      handleProtocols: (protocols) => {
        // Accept the access_token protocol if provided
        if (protocols.has("access_token")) {
          return "access_token";
        }
        return false;
      },
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", async (ws: WebSocket, request: IncomingMessage) => {
      const clientId = this.generateClientId();

      // Enforce a simple per-IP WS connect rate limit to stop connection-spam clients
      // from exhausting memory (each client allocates a heartbeat timer and state).
      const ip = this.extractClientIp(request);
      if (!this.checkConnectRateLimit(ip)) {
        console.warn(`Client ${clientId} rejected: connect rate limit exceeded for ${ip}`);
        ws.close(1013, "Connect rate limit exceeded");
        return;
      }

      // Check authentication if enabled
      const authResult = await this.authenticateConnection(request);
      if (!authResult.authenticated) {
        console.log(`Client ${clientId} authentication failed: ${authResult.error}`);
        ws.close(1008, `Authentication failed: ${authResult.error}`);
        return;
      }

      const namespaceFilter = this.parseNamespaceFilter(request.url);

      const client: Client = {
        id: clientId,
        ws,
        isAlive: true,
        namespaceFilter,
        lastActivity: new Date(),
        authenticated: authResult.authenticated,
      };

      this.clients.set(clientId, client);
      console.log(`Client ${clientId} connected. Total clients: ${this.clients.size}`);

      // Send connection acknowledgment
      this.sendToClient(
        clientId,
        WebSocketMessageFactory.createConnectionMessage("connected", {
          name: "cluster",
          version: "1.0.0",
        }),
      );

      // Setup client event handlers
      ws.on("message", (data) => this.handleClientMessage(clientId, data));
      ws.on("pong", () => this.handlePong(clientId));
      ws.on("close", () => this.handleClientDisconnect(clientId));
      ws.on("error", (error) => this.handleClientError(clientId, error));

      // Emit connection event
      this.emit("clientConnected", { clientId, namespaceFilter });
    });

    this.wss.on("error", (error) => {
      console.error("WebSocket server error:", error);
      this.emit("serverError", error);
    });
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractClientIp(request: IncomingMessage): string {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
      const first = forwarded.split(",")[0];
      if (first) return first.trim();
    }
    return request.socket.remoteAddress || "unknown";
  }

  private checkConnectRateLimit(ip: string): boolean {
    const now = Date.now();
    const cutoff = now - CONNECT_RATE_WINDOW_MS;
    const history = (this.recentConnectsByIp.get(ip) || []).filter((t) => t >= cutoff);
    if (history.length >= CONNECT_RATE_LIMIT) {
      this.recentConnectsByIp.set(ip, history);
      return false;
    }
    history.push(now);
    this.recentConnectsByIp.set(ip, history);
    return true;
  }

  /**
   * Authenticate WebSocket connection
   * Checks for token in WebSocket subprotocol, then falls back to Authorization header
   */
  private async authenticateConnection(
    request: IncomingMessage,
  ): Promise<{ authenticated: boolean; error?: string }> {
    // If auth is not enabled, allow all connections
    if (!this.tokenValidator || !this.tokenValidator.isAuthEnabled()) {
      return { authenticated: true };
    }

    try {
      let token: string | null = null;

      // Try to get token from WebSocket subprotocol
      const protocols = request.headers["sec-websocket-protocol"];
      if (protocols) {
        const protocolList = Array.isArray(protocols)
          ? protocols
          : protocols.split(",").map((p) => p.trim());

        const tokenIndex = protocolList.indexOf("access_token");
        if (tokenIndex !== -1 && protocolList[tokenIndex + 1]) {
          // Decode base64url token
          const encodedToken = protocolList[tokenIndex + 1];
          const base64 = encodedToken.replace(/-/g, "+").replace(/_/g, "/");
          token = Buffer.from(base64, "base64").toString("utf-8");
        }
      }

      // Fallback: Try Authorization header (for backward compatibility)
      if (!token) {
        const authHeader = request.headers["authorization"];
        if (authHeader && authHeader.startsWith("Bearer ")) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        return { authenticated: false, error: "No token provided" };
      }

      // Validate token
      await this.tokenValidator.validateToken(token);
      return { authenticated: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { authenticated: false, error: errorMessage };
    }
  }

  private parseNamespaceFilter(url?: string): string[] | undefined {
    if (!url) return undefined;

    const params = new URLSearchParams(url.split("?")[1] || "");
    const namespaces = params.get("namespaces");

    if (namespaces) {
      // Kubernetes namespace validation
      // eslint-disable-next-line security/detect-unsafe-regex
      const k8sNamespaceRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

      const validated = namespaces
        .split(",")
        .map((ns) => ns.trim())
        .filter((ns) => {
          // Must be 1-63 characters
          if (ns.length === 0 || ns.length > 63) {
            console.warn(`Invalid namespace length: ${ns}`);
            return false;
          }

          // Must match Kubernetes naming rules
          if (!k8sNamespaceRegex.test(ns)) {
            console.warn(`Invalid namespace format: ${ns}`);
            return false;
          }

          return true;
        });

      return validated.length > 0 ? validated : undefined;
    }

    return undefined;
  }

  private handleClientMessage(clientId: string, data: RawData): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "ping":
          this.sendToClient(clientId, WebSocketMessageFactory.createHeartbeatMessage("pong"));
          break;
        default:
          this.emit("clientMessage", { clientId, message });
          break;
      }
    } catch (error) {
      console.error(`Failed to parse message from client ${clientId}:`, error);
      this.sendToClient(
        clientId,
        WebSocketMessageFactory.createErrorMessage("PARSE_ERROR", "Failed to parse message"),
      );
    }
  }

  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      client.lastActivity = new Date();
    }
  }

  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.clients.delete(clientId);
      console.log(`Client ${clientId} disconnected. Total clients: ${this.clients.size}`);
      this.emit("clientDisconnected", { clientId });
    }
  }

  private handleClientError(clientId: string, error: Error): void {
    console.error(`Client ${clientId} error:`, error);
    this.emit("clientError", { clientId, error });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.isAlive === false) {
          console.log(`Client ${clientId} failed heartbeat check, terminating connection`);
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, this.heartbeatIntervalMs);
  }

  sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to client ${clientId}:`, error);
        this.emit("sendError", { clientId, error });
      }
    }
  }

  private isBackpressured(client: Client): boolean {
    if (client.ws.bufferedAmount <= BACKPRESSURE_BYTES) return false;
    const now = Date.now();
    if (!client.backpressureLoggedAt || now - client.backpressureLoggedAt > 30_000) {
      console.warn(
        `Client ${client.id} backpressured: ${client.ws.bufferedAmount} bytes buffered, skipping broadcast`,
      );
      client.backpressureLoggedAt = now;
    }
    return true;
  }

  broadcast(message: WebSocketMessage, filterFn?: (client: Client) => boolean): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState !== WebSocket.OPEN) return;
      if (filterFn && !filterFn(client)) return;
      if (this.isBackpressured(client)) return;
      try {
        client.ws.send(messageStr);
      } catch (error) {
        console.error(`Failed to broadcast to client ${clientId}:`, error);
        this.emit("broadcastError", { clientId, error });
      }
    });
  }

  broadcastToNamespace(namespace: string, message: WebSocketMessage): void {
    this.broadcast(message, (client) => {
      return !client.namespaceFilter || client.namespaceFilter.includes(namespace);
    });
  }

  getConnectedClients(): string[] {
    return Array.from(this.clients.keys());
  }

  getClientCount(): number {
    return this.clients.size;
  }

  getClient(clientId: string): Client | undefined {
    return this.clients.get(clientId);
  }

  closeAllConnections(): void {
    this.clients.forEach((client, _clientId) => {
      client.ws.close(1000, "Server shutting down");
    });
    this.clients.clear();
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval as NodeJS.Timeout);
      this.heartbeatInterval = null;
    }

    this.closeAllConnections();

    this.wss.close(() => {
      console.log("WebSocket server closed");
      this.emit("serverClosed");
    });
  }
}
