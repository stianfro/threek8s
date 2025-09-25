import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { Server } from 'http';
import {
  WebSocketMessage,
  WebSocketMessageFactory
} from '../models/Events';

interface Client {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  namespaceFilter?: string[];
  lastActivity: Date;
}

export class WebSocketManager extends EventEmitter {
  private wss: WebSocketServer;
  private clients: Map<string, Client>;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private heartbeatIntervalMs: number;
  private heartbeatTimeoutMs: number;  // Keeping for potential future use

  constructor(
    server: Server,
    heartbeatIntervalMs: number = 30000,
    heartbeatTimeoutMs: number = 10000
  ) {
    super();
    this.clients = new Map();
    this.heartbeatIntervalMs = heartbeatIntervalMs;
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;

    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: 10 * 1024 * 1024 // 10MB
    });

    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      const clientId = this.generateClientId();
      const namespaceFilter = this.parseNamespaceFilter(request.url);

      const client: Client = {
        id: clientId,
        ws,
        isAlive: true,
        namespaceFilter,
        lastActivity: new Date()
      };

      this.clients.set(clientId, client);
      console.log(`Client ${clientId} connected. Total clients: ${this.clients.size}`);

      // Send connection acknowledgment
      this.sendToClient(clientId, WebSocketMessageFactory.createConnectionMessage(
        'connected',
        { name: 'cluster', version: '1.0.0' }
      ));

      // Setup client event handlers
      ws.on('message', (data) => this.handleClientMessage(clientId, data));
      ws.on('pong', () => this.handlePong(clientId));
      ws.on('close', () => this.handleClientDisconnect(clientId));
      ws.on('error', (error) => this.handleClientError(clientId, error));

      // Emit connection event
      this.emit('clientConnected', { clientId, namespaceFilter });
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
      this.emit('serverError', error);
    });
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseNamespaceFilter(url?: string): string[] | undefined {
    if (!url) return undefined;

    const params = new URLSearchParams(url.split('?')[1] || '');
    const namespaces = params.get('namespaces');

    if (namespaces) {
      return namespaces.split(',').map(ns => ns.trim());
    }

    return undefined;
  }

  private handleClientMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();

    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'ping':
          this.sendToClient(clientId, WebSocketMessageFactory.createHeartbeatMessage('pong'));
          break;
        default:
          this.emit('clientMessage', { clientId, message });
          break;
      }
    } catch (error) {
      console.error(`Failed to parse message from client ${clientId}:`, error);
      this.sendToClient(clientId, WebSocketMessageFactory.createErrorMessage(
        'PARSE_ERROR',
        'Failed to parse message'
      ));
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
      this.emit('clientDisconnected', { clientId });
    }
  }

  private handleClientError(clientId: string, error: Error): void {
    console.error(`Client ${clientId} error:`, error);
    this.emit('clientError', { clientId, error });
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
        this.emit('sendError', { clientId, error });
      }
    }
  }

  broadcast(message: WebSocketMessage, filterFn?: (client: Client) => boolean): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        if (!filterFn || filterFn(client)) {
          try {
            client.ws.send(messageStr);
          } catch (error) {
            console.error(`Failed to broadcast to client ${clientId}:`, error);
            this.emit('broadcastError', { clientId, error });
          }
        }
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
    this.clients.forEach((client, clientId) => {
      client.ws.close(1000, 'Server shutting down');
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
      console.log('WebSocket server closed');
      this.emit('serverClosed');
    });
  }
}