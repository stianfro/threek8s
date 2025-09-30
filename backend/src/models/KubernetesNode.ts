import { Vector3, ResourceInfo, NodeCondition, NodeStatus } from "./ValueObjects";

export interface KubernetesNode {
  name: string;
  uid: string;
  status: NodeStatus;
  role: "master" | "worker" | "control-plane";
  capacity: ResourceInfo;
  allocatable?: ResourceInfo;
  conditions: NodeCondition[];
  position?: Vector3;
  labels: Record<string, string>;
  creationTimestamp: Date;
  zone: string; // Derived from topology.kubernetes.io/zone label, defaults to "N/A"

  // Additional metadata
  podCount?: number;
  architecture?: string;
  kernelVersion?: string;
  osImage?: string;
  containerRuntimeVersion?: string;
  kubeletVersion?: string;
}

export class KubernetesNodeModel implements KubernetesNode {
  name: string;
  uid: string;
  status: NodeStatus;
  role: "master" | "worker" | "control-plane";
  capacity: ResourceInfo;
  allocatable?: ResourceInfo;
  conditions: NodeCondition[];
  position?: Vector3;
  labels: Record<string, string>;
  creationTimestamp: Date;
  zone: string;

  constructor(data: KubernetesNode) {
    this.name = data.name;
    this.uid = data.uid;
    this.status = data.status;
    this.role = data.role;
    this.capacity = data.capacity;
    this.allocatable = data.allocatable;
    this.conditions = data.conditions;
    this.position = data.position;
    this.labels = data.labels;
    this.creationTimestamp = data.creationTimestamp;
    this.zone = data.zone;
  }

  isReady(): boolean {
    const readyCondition = this.conditions.find((c) => c.type === "Ready");
    return readyCondition?.status === "True";
  }

  isMaster(): boolean {
    return this.role === "master" || this.role === "control-plane";
  }

  getCapacityInGB(): number {
    const memory = this.capacity.memory;
    // Convert memory string (e.g., "8Gi") to GB
    const match = memory.match(/(\d+)([A-Za-z]+)/);
    if (match && match[1] && match[2]) {
      const value = parseInt(match[1]);
      const unit = match[2];
      if (unit === "Gi") return value;
      if (unit === "Mi") return value / 1024;
      if (unit === "Ki") return value / (1024 * 1024);
    }
    return 0;
  }
}
