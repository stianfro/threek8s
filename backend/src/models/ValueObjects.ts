/**
 * Value objects for the Kubernetes 3D visualization
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ResourceInfo {
  cpu: string;
  memory: string;
  pods?: string;
  storage?: string;
}

export interface NodeCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  lastTransitionTime: Date;
  reason: string;
  message: string;
}

export interface ContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  state: 'waiting' | 'running' | 'terminated';
}

export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
export type NodeStatus = 'Ready' | 'NotReady' | 'Unknown';
export type NamespaceStatus = 'Active' | 'Terminating';
export type ConnectionStatus = 'Connected' | 'Connecting' | 'Disconnected' | 'Error';

export interface ClusterMetrics {
  totalNodes: number;
  readyNodes: number;
  totalPods: number;
  runningPods: number;
  pendingPods: number;
  failedPods: number;
}