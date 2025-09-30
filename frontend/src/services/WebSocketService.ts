import type { WebSocketMessage, StateUpdate, EventMessage } from "../types/kubernetes";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface WebSocketServiceOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private heartbeatInterval: number;
  private reconnectAttempts: number = 0;
  private heartbeatTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private isManualClose: boolean = false;

  private onStateUpdateCallback?: (state: StateUpdate) => void;
  private onEventCallback?: (event: EventMessage) => void;
  private onStatusChangeCallback?: (status: ConnectionStatus) => void;
  private onErrorCallback?: (error: Error) => void;

  constructor(options: WebSocketServiceOptions) {
    this.url = options.url;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
  }

  public connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    this.isManualClose = false;
    this.updateStatus("connecting");

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.handleError(error as Error);
      this.scheduleReconnect();
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      this.reconnectAttempts = 0;
      this.updateStatus("connected");
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
        this.handleError(new Error("Invalid message format"));
      }
    };

    this.ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      this.updateStatus("error");
      this.handleError(new Error("WebSocket connection error"));
    };

    this.ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      this.stopHeartbeat();
      this.updateStatus("disconnected");

      if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    console.log("[WebSocket] Received message:", message.type, message);

    switch (message.type) {
      case "state":
        if (this.onStateUpdateCallback) {
          this.onStateUpdateCallback(message.data as StateUpdate);
        }
        break;

      case "event":
        if (this.onEventCallback) {
          this.onEventCallback(message.data as EventMessage);
        }
        break;

      // Handle backend's specific event types
      case "node_event":
        if (this.onEventCallback) {
          const nodeEvent: EventMessage = {
            eventType: "node",
            action: (message.action?.toLowerCase() as any) || "modified",
            resource: message.data,
          };
          this.onEventCallback(nodeEvent);
        }
        break;

      case "pod_event":
        if (this.onEventCallback) {
          // Convert backend action format (ADDED, MODIFIED, DELETED) to frontend format
          const action = (message.action?.toLowerCase() as any) || "modified";
          console.log("[WebSocket] Pod event:", action, message.data);
          const podEvent: EventMessage = {
            eventType: "pod",
            action: action,
            resource: message.data,
          };
          this.onEventCallback(podEvent);
        }
        break;

      case "namespace_event":
        if (this.onEventCallback) {
          const namespaceEvent: EventMessage = {
            eventType: "namespace",
            action: (message.action?.toLowerCase() as any) || "modified",
            resource: message.data,
          };
          this.onEventCallback(namespaceEvent);
        }
        break;

      case "metrics":
        // Handle metrics updates as state updates
        if (this.onStateUpdateCallback) {
          this.onStateUpdateCallback({ metrics: message.data });
        }
        break;

      case "ping":
        this.sendPong();
        break;

      case "pong":
        break;

      case "error":
        console.error("Server error:", message.data);
        this.handleError(new Error(message.data?.message || "Server error"));
        break;

      default:
        console.warn("Unknown message type:", message.type, message);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendPing();
      }
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private sendPing(): void {
    this.send({ type: "ping", timestamp: new Date().toISOString() });
  }

  private sendPong(): void {
    this.send({ type: "pong", timestamp: new Date().toISOString() });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    console.log(
      `Reconnecting in ${this.reconnectInterval}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  private updateStatus(status: ConnectionStatus): void {
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(status);
    }
  }

  private handleError(error: Error): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    }
  }

  public send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Failed to send message:", error);
        this.handleError(error as Error);
      }
    } else {
      console.warn("Cannot send message: WebSocket not connected");
    }
  }

  public disconnect(): void {
    this.isManualClose = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "Client disconnecting");
      }
      this.ws = null;
    }

    this.updateStatus("disconnected");
  }

  public onStateUpdate(callback: (state: StateUpdate) => void): void {
    this.onStateUpdateCallback = callback;
  }

  public onEvent(callback: (event: EventMessage) => void): void {
    this.onEventCallback = callback;
  }

  public onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  public onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getStatus(): ConnectionStatus {
    if (!this.ws) return "disconnected";

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return "connecting";
      case WebSocket.OPEN:
        return "connected";
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        return "disconnected";
      default:
        return "disconnected";
    }
  }
}
