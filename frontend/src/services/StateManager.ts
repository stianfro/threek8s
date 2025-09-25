import type { ClusterState, KubernetesNode, Pod, Namespace, ClusterInfo, ClusterMetrics, EventMessage } from '../types/kubernetes';

export type StateChangeListener = (state: ClusterState) => void;
export type EventListener = (event: EventMessage) => void;

export class StateManager {
  private state: ClusterState = {
    nodes: [],
    pods: [],
    namespaces: [],
    metrics: {
      nodeCount: 0,
      podCount: 0,
      namespaceCount: 0,
      nodesByStatus: {},
      podsByStatus: {},
      timestamp: new Date().toISOString()
    }
  };

  private stateListeners: Set<StateChangeListener> = new Set();
  private eventListeners: Set<EventListener> = new Set();

  public getState(): ClusterState {
    return { ...this.state };
  }

  public updateNodes(nodes: KubernetesNode[]): void {
    this.state.nodes = nodes;
    this.updateMetrics();
    this.notifyStateChange();
  }

  public updatePods(pods: Pod[]): void {
    this.state.pods = pods;
    this.updateMetrics();
    this.notifyStateChange();
  }

  public updateNamespaces(namespaces: Namespace[]): void {
    this.state.namespaces = namespaces;
    this.updateMetrics();
    this.notifyStateChange();
  }

  public updateClusterInfo(clusterInfo: ClusterInfo): void {
    this.state.clusterInfo = clusterInfo;
    this.notifyStateChange();
  }

  public updateFullState(state: Partial<ClusterState>): void {
    this.state = {
      ...this.state,
      ...state
    };
    this.updateMetrics();
    this.notifyStateChange();
  }

  public handleNodeEvent(action: 'added' | 'modified' | 'deleted', node: KubernetesNode): void {
    const nodes = [...this.state.nodes];
    const index = nodes.findIndex(n => n.uid === node.uid);

    switch (action) {
      case 'added':
        if (index === -1) {
          nodes.push(node);
        }
        break;
      case 'modified':
        if (index !== -1) {
          nodes[index] = node;
        }
        break;
      case 'deleted':
        if (index !== -1) {
          nodes.splice(index, 1);
        }
        break;
    }

    this.state.nodes = nodes;
    this.updateMetrics();
    this.notifyStateChange();
    this.notifyEvent({ eventType: 'node', action, resource: node });
  }

  public handlePodEvent(action: 'added' | 'modified' | 'deleted', pod: Pod): void {
    const pods = [...this.state.pods];
    const index = pods.findIndex(p => p.uid === pod.uid);

    switch (action) {
      case 'added':
        if (index === -1) {
          pods.push(pod);
        }
        break;
      case 'modified':
        if (index !== -1) {
          pods[index] = pod;
        }
        break;
      case 'deleted':
        if (index !== -1) {
          pods.splice(index, 1);
        }
        break;
    }

    this.state.pods = pods;
    this.updateMetrics();
    this.notifyStateChange();
    this.notifyEvent({ eventType: 'pod', action, resource: pod });
  }

  public handleNamespaceEvent(action: 'added' | 'modified' | 'deleted', namespace: Namespace): void {
    const namespaces = [...this.state.namespaces];
    const index = namespaces.findIndex(n => n.uid === namespace.uid);

    switch (action) {
      case 'added':
        if (index === -1) {
          namespaces.push(namespace);
        }
        break;
      case 'modified':
        if (index !== -1) {
          namespaces[index] = namespace;
        }
        break;
      case 'deleted':
        if (index !== -1) {
          namespaces.splice(index, 1);
        }
        break;
    }

    this.state.namespaces = namespaces;
    this.updateMetrics();
    this.notifyStateChange();
    this.notifyEvent({ eventType: 'namespace', action, resource: namespace });
  }

  private updateMetrics(): void {
    const nodesByStatus: Record<string, number> = {};
    this.state.nodes.forEach(node => {
      nodesByStatus[node.status] = (nodesByStatus[node.status] || 0) + 1;
    });

    const podsByStatus: Record<string, number> = {};
    this.state.pods.forEach(pod => {
      podsByStatus[pod.status] = (podsByStatus[pod.status] || 0) + 1;
    });

    this.state.metrics = {
      nodeCount: this.state.nodes.length,
      podCount: this.state.pods.length,
      namespaceCount: this.state.namespaces.length,
      nodesByStatus,
      podsByStatus,
      timestamp: new Date().toISOString()
    };
  }

  public onStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    listener(this.state);

    return () => {
      this.stateListeners.delete(listener);
    };
  }

  public onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);

    return () => {
      this.eventListeners.delete(listener);
    };
  }

  private notifyStateChange(): void {
    this.stateListeners.forEach(listener => {
      listener(this.state);
    });
  }

  private notifyEvent(event: EventMessage): void {
    this.eventListeners.forEach(listener => {
      listener(event);
    });
  }

  public getNodeByName(name: string): KubernetesNode | undefined {
    return this.state.nodes.find(n => n.name === name);
  }

  public getPodsByNode(nodeName: string): Pod[] {
    return this.state.pods.filter(p => p.nodeName === nodeName);
  }

  public getPodsByNamespace(namespace: string): Pod[] {
    return this.state.pods.filter(p => p.namespace === namespace);
  }

  public getMetrics(): ClusterMetrics {
    return { ...this.state.metrics };
  }

  public clear(): void {
    this.state = {
      nodes: [],
      pods: [],
      namespaces: [],
      metrics: {
        nodeCount: 0,
        podCount: 0,
        namespaceCount: 0,
        nodesByStatus: {},
        podsByStatus: {},
        timestamp: new Date().toISOString()
      }
    };
    this.notifyStateChange();
  }
}