import { Vector3, ContainerInfo, PodPhase } from './ValueObjects';

export interface Pod {
  name: string;
  uid: string;
  namespace: string;
  nodeName: string;
  status: string;
  phase: PodPhase;
  containers: ContainerInfo[];
  position?: Vector3;
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp: Date;
  deletionTimestamp?: Date | null;

  // Resource requests and limits
  requests?: {
    cpu?: string;
    memory?: string;
  };
  limits?: {
    cpu?: string;
    memory?: string;
  };

  // Additional metadata
  restartCount?: number;
  podIP?: string;
  hostIP?: string;
  startTime?: Date;
}

export class PodModel implements Pod {
  name: string;
  uid: string;
  namespace: string;
  nodeName: string;
  status: string;
  phase: PodPhase;
  containers: ContainerInfo[];
  position?: Vector3;
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp: Date;
  deletionTimestamp?: Date | null;

  constructor(data: Pod) {
    this.name = data.name;
    this.uid = data.uid;
    this.namespace = data.namespace;
    this.nodeName = data.nodeName;
    this.status = data.status;
    this.phase = data.phase;
    this.containers = data.containers;
    this.position = data.position;
    this.labels = data.labels;
    this.annotations = data.annotations;
    this.creationTimestamp = data.creationTimestamp;
    this.deletionTimestamp = data.deletionTimestamp;
  }

  isRunning(): boolean {
    return this.phase === 'Running';
  }

  isPending(): boolean {
    return this.phase === 'Pending';
  }

  isFailed(): boolean {
    return this.phase === 'Failed';
  }

  isTerminating(): boolean {
    return this.deletionTimestamp !== null && this.deletionTimestamp !== undefined;
  }

  getAllContainersReady(): boolean {
    return this.containers.every(container => container.ready);
  }

  getContainerCount(): number {
    return this.containers.length;
  }

  getReadyContainerCount(): number {
    return this.containers.filter(c => c.ready).length;
  }

  getStatusColor(): string {
    switch (this.phase) {
      case 'Running':
        return this.getAllContainersReady() ? '#4CAF50' : '#FFC107'; // Green or Yellow
      case 'Pending':
        return '#FF9800'; // Orange
      case 'Failed':
        return '#F44336'; // Red
      case 'Succeeded':
        return '#2196F3'; // Blue
      default:
        return '#9E9E9E'; // Gray
    }
  }
}