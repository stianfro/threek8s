import { NamespaceStatus } from './ValueObjects';

export interface Namespace {
  name: string;
  uid: string;
  status: NamespaceStatus;
  podCount: number;
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: Date;
}

export class NamespaceModel implements Namespace {
  name: string;
  uid: string;
  status: NamespaceStatus;
  podCount: number;
  labels: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: Date;

  constructor(data: Namespace) {
    this.name = data.name;
    this.uid = data.uid;
    this.status = data.status;
    this.podCount = data.podCount;
    this.labels = data.labels;
    this.annotations = data.annotations;
    this.creationTimestamp = data.creationTimestamp;
  }

  isActive(): boolean {
    return this.status === 'Active';
  }

  isTerminating(): boolean {
    return this.status === 'Terminating';
  }

  isSystemNamespace(): boolean {
    const systemNamespaces = ['kube-system', 'kube-public', 'kube-node-lease'];
    return systemNamespaces.includes(this.name);
  }

  incrementPodCount(): void {
    this.podCount++;
  }

  decrementPodCount(): void {
    if (this.podCount > 0) {
      this.podCount--;
    }
  }

  updatePodCount(count: number): void {
    this.podCount = Math.max(0, count);
  }
}