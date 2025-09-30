import { KubernetesNode } from "./KubernetesNode";
import { Pod } from "./Pod";
import { Namespace } from "./Namespace";
import { ConnectionStatus, ClusterMetrics } from "./ValueObjects";

export interface ClusterState {
  nodes: Map<string, KubernetesNode>;
  pods: Map<string, Pod>;
  namespaces: Map<string, Namespace>;
  connectionStatus: ConnectionStatus;
  lastUpdated: Date;
  metrics: ClusterMetrics;
  clusterInfo?: {
    name: string;
    version: string;
    apiServer?: string;
  };
}

export class ClusterStateModel implements ClusterState {
  nodes: Map<string, KubernetesNode>;
  pods: Map<string, Pod>;
  namespaces: Map<string, Namespace>;
  connectionStatus: ConnectionStatus;
  lastUpdated: Date;
  metrics: ClusterMetrics;
  clusterInfo?: {
    name: string;
    version: string;
    apiServer?: string;
  };

  // Secondary indices for fast lookups
  private podsByNode: Map<string, Set<string>>;
  private podsByNamespace: Map<string, Set<string>>;

  constructor() {
    this.nodes = new Map();
    this.pods = new Map();
    this.namespaces = new Map();
    this.connectionStatus = "Disconnected";
    this.lastUpdated = new Date();
    this.metrics = this.calculateMetrics();

    this.podsByNode = new Map();
    this.podsByNamespace = new Map();
  }

  // Node operations
  addNode(node: KubernetesNode): void {
    this.nodes.set(node.name, node);
    this.updateLastUpdated();
    this.recalculateMetrics();
  }

  updateNode(node: KubernetesNode): void {
    this.nodes.set(node.name, node);
    this.updateLastUpdated();
    this.recalculateMetrics();
  }

  deleteNode(nodeName: string): void {
    this.nodes.delete(nodeName);
    // Remove pods from this node
    const podIds = this.podsByNode.get(nodeName) || new Set();
    podIds.forEach((podId) => this.deletePod(podId));
    this.podsByNode.delete(nodeName);
    this.updateLastUpdated();
    this.recalculateMetrics();
  }

  getNode(nodeName: string): KubernetesNode | undefined {
    return this.nodes.get(nodeName);
  }

  // Pod operations
  addPod(pod: Pod): void {
    this.pods.set(pod.uid, pod);

    // Update indices
    if (!this.podsByNode.has(pod.nodeName)) {
      this.podsByNode.set(pod.nodeName, new Set());
    }
    this.podsByNode.get(pod.nodeName)?.add(pod.uid);

    if (!this.podsByNamespace.has(pod.namespace)) {
      this.podsByNamespace.set(pod.namespace, new Set());
    }
    this.podsByNamespace.get(pod.namespace)?.add(pod.uid);

    // Update namespace pod count
    const namespace = this.namespaces.get(pod.namespace);
    if (namespace) {
      namespace.podCount++;
    }

    this.updateLastUpdated();
    this.recalculateMetrics();
  }

  updatePod(pod: Pod): void {
    const existingPod = this.pods.get(pod.uid);

    // Handle node changes
    if (existingPod && existingPod.nodeName !== pod.nodeName) {
      this.podsByNode.get(existingPod.nodeName)?.delete(pod.uid);
      if (!this.podsByNode.has(pod.nodeName)) {
        this.podsByNode.set(pod.nodeName, new Set());
      }
      this.podsByNode.get(pod.nodeName)?.add(pod.uid);
    }

    this.pods.set(pod.uid, pod);
    this.updateLastUpdated();
    this.recalculateMetrics();
  }

  deletePod(podUid: string): void {
    const pod = this.pods.get(podUid);
    if (pod) {
      this.podsByNode.get(pod.nodeName)?.delete(podUid);
      this.podsByNamespace.get(pod.namespace)?.delete(podUid);

      // Update namespace pod count
      const namespace = this.namespaces.get(pod.namespace);
      if (namespace && namespace.podCount > 0) {
        namespace.podCount--;
      }
    }

    this.pods.delete(podUid);
    this.updateLastUpdated();
    this.recalculateMetrics();
  }

  getPod(podUid: string): Pod | undefined {
    return this.pods.get(podUid);
  }

  getPodsByNode(nodeName: string): Pod[] {
    const podIds = this.podsByNode.get(nodeName) || new Set();
    return Array.from(podIds)
      .map((id) => this.pods.get(id))
      .filter((pod): pod is Pod => pod !== undefined);
  }

  getPodsByNamespace(namespace: string): Pod[] {
    const podIds = this.podsByNamespace.get(namespace) || new Set();
    return Array.from(podIds)
      .map((id) => this.pods.get(id))
      .filter((pod): pod is Pod => pod !== undefined);
  }

  // Namespace operations
  addNamespace(namespace: Namespace): void {
    this.namespaces.set(namespace.name, namespace);
    this.updateLastUpdated();
  }

  updateNamespace(namespace: Namespace): void {
    this.namespaces.set(namespace.name, namespace);
    this.updateLastUpdated();
  }

  deleteNamespace(namespaceName: string): void {
    this.namespaces.delete(namespaceName);
    // Delete all pods in this namespace
    const podIds = this.podsByNamespace.get(namespaceName) || new Set();
    podIds.forEach((podId) => this.deletePod(podId));
    this.podsByNamespace.delete(namespaceName);
    this.updateLastUpdated();
  }

  // State management
  setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.updateLastUpdated();
  }

  clear(): void {
    this.nodes.clear();
    this.pods.clear();
    this.namespaces.clear();
    this.podsByNode.clear();
    this.podsByNamespace.clear();
    this.connectionStatus = "Disconnected";
    this.updateLastUpdated();
    this.recalculateMetrics();
  }

  private updateLastUpdated(): void {
    this.lastUpdated = new Date();
  }

  private calculateMetrics(): ClusterMetrics {
    const pods = Array.from(this.pods.values());
    const nodes = Array.from(this.nodes.values());

    return {
      totalNodes: nodes.length,
      readyNodes: nodes.filter((n) => n.status === "Ready").length,
      totalPods: pods.length,
      runningPods: pods.filter((p) => p.phase === "Running").length,
      pendingPods: pods.filter((p) => p.phase === "Pending").length,
      failedPods: pods.filter((p) => p.phase === "Failed").length,
    };
  }

  private recalculateMetrics(): void {
    this.metrics = this.calculateMetrics();
  }

  // Serialization
  toJSON(): any {
    return {
      nodes: Array.from(this.nodes.values()),
      pods: Array.from(this.pods.values()),
      namespaces: Array.from(this.namespaces.values()),
      connectionStatus: this.connectionStatus,
      lastUpdated: this.lastUpdated,
      metrics: this.metrics,
      clusterInfo: this.clusterInfo,
    };
  }
}
