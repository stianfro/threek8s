import { EventEmitter } from "events";
import { KubernetesService } from "./KubernetesService";
import { WatchManager } from "./WatchManager";
import { StateManager } from "./StateManager";
import { WebSocketManager } from "./WebSocketManager";
import { WatchEvent, WebSocketMessageFactory, EventType } from "../models/Events";
import { KubernetesNode } from "../models/KubernetesNode";
import { Pod, isPodVisible } from "../models/Pod";
import { Namespace } from "../models/Namespace";
import { ClusterMetrics } from "../models/ValueObjects";

export class EventProcessor extends EventEmitter {
  private kubernetesService: KubernetesService;
  private watchManager: WatchManager;
  private stateManager: StateManager;
  private webSocketManager: WebSocketManager;
  private eventQueue: WatchEvent[] = [];
  private processingInterval: NodeJS.Timer | null = null;
  private batchSize: number = 50;
  private batchIntervalMs: number = 100;
  private static readonly MAX_QUEUE_SIZE = 10000;
  private static readonly INITIAL_POD_CHUNK = 500;
  private droppedEventCount: number = 0;

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
    if (this.eventQueue.length >= EventProcessor.MAX_QUEUE_SIZE) {
      this.eventQueue.shift();
      this.droppedEventCount++;
      if (this.droppedEventCount === 1 || this.droppedEventCount % 1000 === 0) {
        console.warn(
          `EventProcessor: event queue full, dropped ${this.droppedEventCount} oldest events`,
        );
      }
    }
    this.eventQueue.push({
      ...event,
      object: { ...(event.object as object), _resourceType: resourceType },
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
    const obj = event.object as { _resourceType?: string };
    const resourceType = obj._resourceType;
    delete obj._resourceType;

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
    const node = this.kubernetesService["transformNode"](event.object as never);

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
    const pod = this.kubernetesService["transformPod"](event.object as never);
    const visible = isPodVisible(pod);

    if (event.type === "DELETED") {
      this.stateManager.deletePod(pod.uid);
      return;
    }

    if (!visible) {
      // Synthesize a DELETED for pods that transitioned into Succeeded/Failed so the
      // frontend drops them instead of accumulating indefinitely.
      if (this.stateManager.hasPod(pod.uid)) {
        this.stateManager.deletePod(pod.uid);
      }
      return;
    }

    if (event.type === "ADDED") {
      this.stateManager.addPod(pod);
    } else {
      // MODIFIED: handle the case where a pod first entered state while invisible and
      // is now visible (updatePod would silently no-op). addPod covers both.
      if (this.stateManager.hasPod(pod.uid)) {
        this.stateManager.updatePod(pod);
      } else {
        this.stateManager.addPod(pod);
      }
    }
  }

  private processNamespaceEvent(event: WatchEvent): void {
    const namespace = this.kubernetesService["transformNamespace"](event.object as never);

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

  private broadcastNodeEvent(action: string, node: KubernetesNode | Partial<KubernetesNode>): void {
    const message = WebSocketMessageFactory.createNodeEventMessage(action as EventType, node);
    this.webSocketManager.broadcast(message);
  }

  private broadcastPodEvent(action: string, pod: Pod): void {
    const message = WebSocketMessageFactory.createPodEventMessage(action as EventType, pod);

    // If pod has namespace, only broadcast to clients interested in that namespace
    if (pod.namespace) {
      this.webSocketManager.broadcastToNamespace(pod.namespace, message);
    } else {
      this.webSocketManager.broadcast(message);
    }
  }

  private broadcastNamespaceEvent(action: string, namespace: Namespace | Partial<Namespace>): void {
    const message = {
      type: "namespace_event",
      action,
      data: namespace,
      timestamp: new Date().toISOString(),
    };
    this.webSocketManager.broadcast(message);
  }

  private broadcastMetrics(metrics: ClusterMetrics): void {
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

      // Send nodes and namespaces synchronously; they are tiny. Start pods empty so the
      // frontend can render the grid immediately, then stream pods in chunked batches.
      const headerMessage = WebSocketMessageFactory.createInitialStateMessage({
        nodes: state.nodes,
        pods: [],
        namespaces: state.namespaces,
      });
      this.webSocketManager.sendToClient(clientId, headerMessage);

      this.webSocketManager.sendToClient(clientId, {
        type: "metrics",
        data: state.metrics,
        timestamp: new Date().toISOString(),
      });

      const pods = state.pods;
      for (let i = 0; i < pods.length; i += EventProcessor.INITIAL_POD_CHUNK) {
        const chunk = pods.slice(i, i + EventProcessor.INITIAL_POD_CHUNK);
        this.webSocketManager.sendToClient(clientId, {
          type: "initial_state_chunk",
          data: { pods: chunk, offset: i, total: pods.length },
          timestamp: new Date().toISOString(),
        });
        // Yield to the event loop between chunks so the socket drains and other clients
        // aren't starved on large initial sends.
        if (i + EventProcessor.INITIAL_POD_CHUNK < pods.length) {
          // eslint-disable-next-line no-undef
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
      }

      this.webSocketManager.sendToClient(clientId, {
        type: "initial_state_end",
        data: { podCount: pods.length },
        timestamp: new Date().toISOString(),
      });
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

  getDroppedEventCount(): number {
    return this.droppedEventCount;
  }

  isProcessing(): boolean {
    return this.processingInterval !== null;
  }
}
