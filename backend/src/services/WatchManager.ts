import { Watch, KubeConfig, CoreV1Api } from "@kubernetes/client-node";
import { EventEmitter } from "events";
import { WatchEvent, EventType } from "../models/Events";

export class WatchManager extends EventEmitter {
  private watch: Watch;
  private kubeConfig: KubeConfig;
  private coreApi: CoreV1Api;
  private nodeWatchRequest: AbortController | null = null;
  private podWatchRequest: AbortController | null = null;
  private namespaceWatchRequest: AbortController | null = null;
  private isWatching: boolean = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;

  constructor(kubeConfig: KubeConfig) {
    super();
    this.kubeConfig = kubeConfig;
    this.coreApi = this.kubeConfig.makeApiClient(CoreV1Api);
    this.watch = new Watch(this.kubeConfig);
  }

  async startWatching(): Promise<void> {
    if (this.isWatching) {
      console.log("Already watching cluster resources");
      return;
    }

    this.isWatching = true;
    await this.watchNodes();
    await this.watchPods();
    await this.watchNamespaces();
  }

  private async watchNodes(): Promise<void> {
    const path = "/api/v1/nodes";

    try {
      this.nodeWatchRequest = await this.watch.watch(
        path,
        {},
        (type: string, apiObj: unknown) => {
          this.handleWatchEvent("node", type as EventType, apiObj);
        },
        (error: Error) => {
          this.handleWatchError("node", error);
        },
      );
    } catch (error) {
      console.error("Failed to start node watch:", error);
      this.emit("error", { resource: "node", error });
    }
  }

  private async watchPods(): Promise<void> {
    const path = "/api/v1/pods";

    try {
      this.podWatchRequest = await this.watch.watch(
        path,
        { allowWatchBookmarks: true },
        (type: string, apiObj: unknown) => {
          this.handleWatchEvent("pod", type as EventType, apiObj);
        },
        (error: Error) => {
          this.handleWatchError("pod", error);
        },
      );
    } catch (error) {
      console.error("Failed to start pod watch:", error);
      this.emit("error", { resource: "pod", error });
    }
  }

  private async watchNamespaces(): Promise<void> {
    const path = "/api/v1/namespaces";

    try {
      this.namespaceWatchRequest = await this.watch.watch(
        path,
        {},
        (type: string, apiObj: unknown) => {
          this.handleWatchEvent("namespace", type as EventType, apiObj);
        },
        (error: Error) => {
          this.handleWatchError("namespace", error);
        },
      );
    } catch (error) {
      console.error("Failed to start namespace watch:", error);
      this.emit("error", { resource: "namespace", error });
    }
  }

  private handleWatchEvent(resource: string, type: EventType, apiObj: unknown): void {
    const event: WatchEvent = {
      type,
      object: apiObj,
      timestamp: new Date(),
    };

    // Emit specific events based on resource type
    switch (resource) {
      case "node":
        this.emit("nodeEvent", event);
        break;
      case "pod":
        this.emit("podEvent", event);
        break;
      case "namespace":
        this.emit("namespaceEvent", event);
        break;
    }

    // Also emit a general event
    this.emit("watchEvent", { resource, ...event });
  }

  private handleWatchError(resource: string, error: Error): void {
    console.error(`Watch error for ${resource}:`, error);
    this.emit("watchError", { resource, error });

    // Attempt to reconnect
    if (this.isWatching) {
      this.scheduleReconnect(resource);
    }
  }

  private scheduleReconnect(resource: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for ${resource}`);
      this.emit("maxReconnectAttemptsReached", { resource });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    console.log(
      `Scheduling reconnect for ${resource} in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    this.reconnectTimeout = setTimeout(async () => {
      try {
        switch (resource) {
          case "node":
            await this.watchNodes();
            break;
          case "pod":
            await this.watchPods();
            break;
          case "namespace":
            await this.watchNamespaces();
            break;
        }
        this.reconnectAttempts = 0; // Reset on successful reconnect
        console.log(`Successfully reconnected ${resource} watch`);
      } catch (error) {
        console.error(`Reconnection failed for ${resource}:`, error);
        this.scheduleReconnect(resource);
      }
    }, delay);
  }

  stopWatching(): void {
    this.isWatching = false;

    if (this.nodeWatchRequest) {
      this.nodeWatchRequest.abort();
      this.nodeWatchRequest = null;
    }

    if (this.podWatchRequest) {
      this.podWatchRequest.abort();
      this.podWatchRequest = null;
    }

    if (this.namespaceWatchRequest) {
      this.namespaceWatchRequest.abort();
      this.namespaceWatchRequest = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectAttempts = 0;
    this.emit("watchingStopped");
  }

  isActive(): boolean {
    return this.isWatching;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }
}
