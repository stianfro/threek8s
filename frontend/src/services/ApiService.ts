import type {
  ClusterInfo,
  ClusterState,
  KubernetesNode,
  Pod,
  Namespace,
} from "../types/kubernetes";

export class ApiService {
  private baseUrl: string;
  private getAccessToken: (() => string | null) | null = null;

  constructor(baseUrl: string = "http://localhost:3001/api") {
    this.baseUrl = baseUrl;
  }

  /**
   * Set function to retrieve access token
   * Called before each API request to get fresh token
   */
  setAccessTokenProvider(getToken: () => string | null): void {
    this.getAccessToken = getToken;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    // Build headers with optional Authorization
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add existing headers
    if (options?.headers) {
      const existingHeaders = new Headers(options.headers);
      existingHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    }

    // Add Authorization header if token is available
    if (this.getAccessToken) {
      const token = this.getAccessToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
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
