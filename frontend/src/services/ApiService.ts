import type {
  ClusterInfo,
  ClusterState,
  KubernetesNode,
  Pod,
  Namespace,
} from "../types/kubernetes";

export class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:3001/api") {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || `Request failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  public async getHealth(): Promise<{
    status: string;
    kubernetes: { connected: boolean; clusterName?: string };
    timestamp: string;
  }> {
    return this.fetch("/health");
  }

  public async getClusterInfo(): Promise<ClusterInfo> {
    return this.fetch("/cluster/info");
  }

  public async getClusterState(): Promise<ClusterState> {
    return this.fetch("/cluster/state");
  }

  public async getNodes(): Promise<KubernetesNode[]> {
    return this.fetch("/nodes");
  }

  public async getNode(name: string): Promise<KubernetesNode> {
    return this.fetch(`/nodes/${name}`);
  }

  public async getPods(namespace?: string): Promise<Pod[]> {
    const query = namespace ? `?namespace=${namespace}` : "";
    return this.fetch(`/pods${query}`);
  }

  public async getPod(namespace: string, name: string): Promise<Pod> {
    return this.fetch(`/pods/${namespace}/${name}`);
  }

  public async getNamespaces(): Promise<Namespace[]> {
    return this.fetch("/namespaces");
  }

  public async getNamespace(name: string): Promise<Namespace> {
    return this.fetch(`/namespaces/${name}`);
  }

  public async getMetrics(): Promise<{
    nodes: number;
    pods: number;
    namespaces: number;
    timestamp: string;
  }> {
    return this.fetch("/cluster/metrics");
  }
}
