import { EventEmitter } from "events";
import { KubernetesService } from "./KubernetesService";
import { WatchManager } from "./WatchManager";
import { StateManager } from "./StateManager";
import { WebSocketManager } from "./WebSocketManager";
import { WatchEvent, WebSocketMessageFactory } from "../models/Events";
import { KubernetesNode } from "../models/KubernetesNode";
import { Pod } from "../models/Pod";
import { Namespace } from "../models/Namespace";

export class EventProcessor extends EventEmitter {
  private kubernetesService: KubernetesService;
  private watchManager: WatchManager;
  private stateManager: StateManager;
  private webSocketManager: WebSocketManager;
  private eventQueue: WatchEvent[] = [];
  private processingInterval: NodeJS.Timer | null = null;
  private batchSize: number = 50;
  private batchIntervalMs: number = 100;

  constructor(
    kubernetesService: KubernetesService,
    watchManager: WatchManager,
    stateManager: StateManager,
    webSocketManager: WebSocketManager,
  ) {
    super();
    this.kubernetesService = kubernetesService;
    this.watchManager = watchManager;
    this.stateManager = stateManager;
    this.webSocketManager = webSocketManager;

    this.setupEventListeners();
    this.startProcessing();
  }

  private setupEventListeners(): void {
    // Listen to watch events
    this.watchManager.on("nodeEvent", (event: WatchEvent) => {
      this.queueEvent(event, "node");
    });

    this.watchManager.on("podEvent", (event: WatchEvent) => {
      this.queueEvent(event, "pod");
    });

    this.watchManager.on("namespaceEvent", (event: WatchEvent) => {
      this.queueEvent(event, "namespace");
    });

    // Listen to state changes
    this.stateManager.on("nodeAdded", (node: KubernetesNode) => {
      this.broadcastNodeEvent("ADDED", node);
    });

    this.stateManager.on("nodeUpdated", (node: KubernetesNode) => {
      this.broadcastNodeEvent("MODIFIED", node);
    });

    this.stateManager.on("nodeDeleted", (node: KubernetesNode) => {
      this.broadcastNodeEvent("DELETED", node);
    });

    this.stateManager.on("podAdded", (pod: Pod) => {
      this.broadcastPodEvent("ADDED", pod);
    });

    this.stateManager.on("podUpdated", (pod: Pod) => {
      this.broadcastPodEvent("MODIFIED", pod);
    });

    this.stateManager.on("podDeleted", (pod: Pod) => {
      this.broadcastPodEvent("DELETED", pod);
    });

    this.stateManager.on("namespaceAdded", (namespace: Namespace) => {
      this.broadcastNamespaceEvent("ADDED", namespace);
    });

    this.stateManager.on("namespaceUpdated", (namespace: Namespace) => {
      this.broadcastNamespaceEvent("MODIFIED", namespace);
    });

    this.stateManager.on("namespaceDeleted", (namespaceName: string) => {
      this.broadcastNamespaceEvent("DELETED", { name: namespaceName });
    });

    this.stateManager.on("metricsUpdated", (metrics) => {
      this.broadcastMetrics(metrics);
    });

    // Listen to WebSocket client connections
    this.webSocketManager.on("clientConnected", async ({ clientId }) => {
      await this.sendInitialState(clientId);
    });
  }

  private queueEvent(event: WatchEvent, resourceType: string): void {
    this.eventQueue.push({
      ...event,
      object: { ...event.object, _resourceType: resourceType },
    });
  }

  private startProcessing(): void {
    this.processingInterval = setInterval(() => {
      this.processBatch();
    }, this.batchIntervalMs);
  }

  private processBatch(): void {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0, this.batchSize);

    batch.forEach((event) => {
      try {
        this.processEvent(event);
      } catch (error) {
        console.error("Failed to process event:", error);
        this.emit("processingError", { event, error });
      }
    });
  }

  private processEvent(event: WatchEvent): void {
    const resourceType = event.object._resourceType;
    delete event.object._resourceType;

    switch (resourceType) {
      case "node":
        this.processNodeEvent(event);
        break;
      case "pod":
        this.processPodEvent(event);
        break;
      case "namespace":
        this.processNamespaceEvent(event);
        break;
    }
  }

  private processNodeEvent(event: WatchEvent): void {
    const node = this.kubernetesService["transformNode"](event.object);

    switch (event.type) {
      case "ADDED":
        this.stateManager.addNode(node);
        break;
      case "MODIFIED":
        this.stateManager.updateNode(node);
        break;
      case "DELETED":
        this.stateManager.deleteNode(node.name);
        break;
    }
  }

  private processPodEvent(event: WatchEvent): void {
    const pod = this.kubernetesService["transformPod"](event.object);

    switch (event.type) {
      case "ADDED":
        this.stateManager.addPod(pod);
        break;
      case "MODIFIED":
        this.stateManager.updatePod(pod);
        break;
      case "DELETED":
        this.stateManager.deletePod(pod.uid);
        break;
    }
  }

  private processNamespaceEvent(event: WatchEvent): void {
    const namespace = this.kubernetesService["transformNamespace"](event.object);

    switch (event.type) {
      case "ADDED":
        this.stateManager.addNamespace(namespace);
        break;
      case "MODIFIED":
        this.stateManager.updateNamespace(namespace);
        break;
      case "DELETED":
        this.stateManager.deleteNamespace(namespace.name);
        break;
    }
  }

  private broadcastNodeEvent(action: string, node: any): void {
    const message = WebSocketMessageFactory.createNodeEventMessage(action as any, node);
    this.webSocketManager.broadcast(message);
  }

  private broadcastPodEvent(action: string, pod: any): void {
    const message = WebSocketMessageFactory.createPodEventMessage(action as any, pod);

    // If pod has namespace, only broadcast to clients interested in that namespace
    if (pod.namespace) {
      this.webSocketManager.broadcastToNamespace(pod.namespace, message);
    } else {
      this.webSocketManager.broadcast(message);
    }
  }

  private broadcastNamespaceEvent(action: string, namespace: any): void {
    const message = {
      type: "namespace_event",
      action,
      data: namespace,
      timestamp: new Date().toISOString(),
    };
    this.webSocketManager.broadcast(message);
  }

  private broadcastMetrics(metrics: any): void {
    const message = {
      type: "metrics",
      data: metrics,
      timestamp: new Date().toISOString(),
    };
    this.webSocketManager.broadcast(message);
  }

  private async sendInitialState(clientId: string): Promise<void> {
    try {
      const state = this.stateManager.getState();
      const message = WebSocketMessageFactory.createInitialStateMessage({
        nodes: state.nodes,
        pods: state.pods,
        namespaces: state.namespaces,
      });

      this.webSocketManager.sendToClient(clientId, message);

      // Also send current metrics
      const metricsMessage = {
        type: "metrics",
        data: state.metrics,
        timestamp: new Date().toISOString(),
      };
      this.webSocketManager.sendToClient(clientId, metricsMessage);
    } catch (error) {
      console.error(`Failed to send initial state to client ${clientId}:`, error);
      this.webSocketManager.sendToClient(
        clientId,
        WebSocketMessageFactory.createErrorMessage(
          "INITIAL_STATE_ERROR",
          "Failed to send initial state",
        ),
      );
    }
  }

  async initialize(): Promise<void> {
    try {
      // Load initial state from Kubernetes
      const [nodes, pods, namespaces] = await Promise.all([
        this.kubernetesService.getNodes(),
        this.kubernetesService.getPods(),
        this.kubernetesService.getNamespaces(),
      ]);

      this.stateManager.loadInitialState(nodes, pods, namespaces);

      // Start watching for changes
      await this.watchManager.startWatching();

      console.log("EventProcessor initialized successfully");
      this.emit("initialized");
    } catch (error) {
      console.error("Failed to initialize EventProcessor:", error);
      this.emit("initializationError", error);
      throw error;
    }
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval as NodeJS.Timeout);
      this.processingInterval = null;
    }

    this.watchManager.stopWatching();
    this.eventQueue = [];

    console.log("EventProcessor stopped");
    this.emit("stopped");
  }

  getQueueSize(): number {
    return this.eventQueue.length;
  }

  isProcessing(): boolean {
    return this.processingInterval !== null;
  }
}
