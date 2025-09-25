import { ClusterStateModel } from '../models/ClusterState';
import { KubernetesNode } from '../models/KubernetesNode';
import { Pod } from '../models/Pod';
import { Namespace } from '../models/Namespace';
import { EventEmitter } from 'events';

export class StateManager extends EventEmitter {
  private state: ClusterStateModel;

  constructor() {
    super();
    this.state = new ClusterStateModel();
  }

  // Node operations
  addNode(node: KubernetesNode): void {
    this.state.addNode(node);
    this.emit('nodeAdded', node);
    this.emitMetricsUpdate();
  }

  updateNode(node: KubernetesNode): void {
    this.state.updateNode(node);
    this.emit('nodeUpdated', node);
    this.emitMetricsUpdate();
  }

  deleteNode(nodeName: string): void {
    const node = this.state.getNode(nodeName);
    if (node) {
      this.state.deleteNode(nodeName);
      this.emit('nodeDeleted', node);
      this.emitMetricsUpdate();
    }
  }

  // Pod operations
  addPod(pod: Pod): void {
    this.state.addPod(pod);
    this.emit('podAdded', pod);
    this.emitMetricsUpdate();
  }

  updatePod(pod: Pod): void {
    this.state.updatePod(pod);
    this.emit('podUpdated', pod);
    this.emitMetricsUpdate();
  }

  deletePod(podUid: string): void {
    const pod = this.state.getPod(podUid);
    if (pod) {
      this.state.deletePod(podUid);
      this.emit('podDeleted', pod);
      this.emitMetricsUpdate();
    }
  }

  // Namespace operations
  addNamespace(namespace: Namespace): void {
    this.state.addNamespace(namespace);
    this.emit('namespaceAdded', namespace);
  }

  updateNamespace(namespace: Namespace): void {
    this.state.updateNamespace(namespace);
    this.emit('namespaceUpdated', namespace);
  }

  deleteNamespace(namespaceName: string): void {
    this.state.deleteNamespace(namespaceName);
    this.emit('namespaceDeleted', namespaceName);
  }

  // State queries
  getState() {
    return this.state.toJSON();
  }

  getNodes(): KubernetesNode[] {
    return Array.from(this.state.nodes.values());
  }

  getPods(): Pod[] {
    return Array.from(this.state.pods.values());
  }

  getNamespaces(): Namespace[] {
    return Array.from(this.state.namespaces.values());
  }

  getPodsByNode(nodeName: string): Pod[] {
    return this.state.getPodsByNode(nodeName);
  }

  getPodsByNamespace(namespace: string): Pod[] {
    return this.state.getPodsByNamespace(namespace);
  }

  getMetrics() {
    return this.state.metrics;
  }

  // Connection management
  setConnectionStatus(status: 'Connected' | 'Connecting' | 'Disconnected' | 'Error'): void {
    this.state.setConnectionStatus(status);
    this.emit('connectionStatusChanged', status);
  }

  setClusterInfo(info: { name: string; version: string; apiServer?: string }): void {
    this.state.clusterInfo = info;
    this.emit('clusterInfoUpdated', info);
  }

  // State management
  clear(): void {
    this.state.clear();
    this.emit('stateCleared');
    this.emitMetricsUpdate();
  }

  loadInitialState(nodes: KubernetesNode[], pods: Pod[], namespaces: Namespace[]): void {
    this.clear();

    namespaces.forEach(ns => this.state.addNamespace(ns));
    nodes.forEach(node => this.state.addNode(node));
    pods.forEach(pod => this.state.addPod(pod));

    this.emit('initialStateLoaded', this.getState());
    this.emitMetricsUpdate();
  }

  private emitMetricsUpdate(): void {
    this.emit('metricsUpdated', this.state.metrics);
  }
}