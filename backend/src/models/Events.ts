/**
 * Event types for Kubernetes watch streams
 */

export type EventType = 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR';

export interface WatchEvent<T = any> {
  type: EventType;
  object: T;
  timestamp: Date;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: string;
  error?: {
    code: string;
    message: string;
    details?: string;
  };
}

export interface ConnectionMessage extends WebSocketMessage {
  type: 'connection';
  status: 'connected' | 'disconnected';
  cluster?: {
    name: string;
    version: string;
  };
}

export interface InitialStateMessage extends WebSocketMessage {
  type: 'initial_state';
  data: {
    nodes: any[];
    pods: any[];
    namespaces: any[];
  };
}

export interface NodeEventMessage extends WebSocketMessage {
  type: 'node_event';
  action: EventType;
  data: any;
}

export interface PodEventMessage extends WebSocketMessage {
  type: 'pod_event';
  action: EventType;
  data: any;
}

export interface NamespaceEventMessage extends WebSocketMessage {
  type: 'namespace_event';
  action: EventType;
  data: any;
}

export interface MetricsMessage extends WebSocketMessage {
  type: 'metrics';
  data: {
    totalNodes: number;
    readyNodes: number;
    totalPods: number;
    runningPods: number;
    pendingPods: number;
    failedPods: number;
  };
}

export interface HeartbeatMessage extends WebSocketMessage {
  type: 'ping' | 'pong';
}

export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  error: {
    code: string;
    message: string;
    details?: string;
  };
}

export type WebSocketEvent =
  | ConnectionMessage
  | InitialStateMessage
  | NodeEventMessage
  | PodEventMessage
  | NamespaceEventMessage
  | MetricsMessage
  | HeartbeatMessage
  | ErrorMessage;

export class WebSocketMessageFactory {
  static createConnectionMessage(status: 'connected' | 'disconnected', cluster?: { name: string; version: string }): ConnectionMessage {
    return {
      type: 'connection',
      status,
      cluster,
      timestamp: new Date().toISOString()
    };
  }

  static createInitialStateMessage(data: { nodes: any[]; pods: any[]; namespaces: any[] }): InitialStateMessage {
    return {
      type: 'initial_state',
      data,
      timestamp: new Date().toISOString()
    };
  }

  static createNodeEventMessage(action: EventType, data: any): NodeEventMessage {
    return {
      type: 'node_event',
      action,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static createPodEventMessage(action: EventType, data: any): PodEventMessage {
    return {
      type: 'pod_event',
      action,
      data,
      timestamp: new Date().toISOString()
    };
  }

  static createErrorMessage(code: string, message: string, details?: string): ErrorMessage {
    return {
      type: 'error',
      error: {
        code,
        message,
        details
      },
      timestamp: new Date().toISOString()
    };
  }

  static createHeartbeatMessage(type: 'ping' | 'pong'): HeartbeatMessage {
    return {
      type,
      timestamp: new Date().toISOString()
    };
  }
}