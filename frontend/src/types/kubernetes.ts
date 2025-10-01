export interface KubernetesNode {
  name: string;
  uid: string;
  status: "Ready" | "NotReady" | "Unknown";
  role: "master" | "worker" | "control-plane";
  capacity: {
    cpu: string;
    memory: string;
    pods: string;
  };
  allocatable: {
    cpu: string;
    memory: string;
    pods: string;
  };
  labels: Record<string, string>;
  addresses: {
    type: string;
    address: string;
  }[];
  conditions: {
    type: string;
    status: string;
    message?: string;
  }[];
  kubeletVersion: string;
  containerRuntimeVersion: string;
  operatingSystem: string;
  architecture: string;
  creationTimestamp: string;
  zone: string; // Derived from topology.kubernetes.io/zone label, defaults to "N/A"
}

export interface Pod {
  name: string;
  uid: string;
  namespace: string;
  nodeName: string;
  status: PodStatus;
  phase: "Pending" | "Running" | "Succeeded" | "Failed" | "Unknown";
  conditions: {
    type: string;
    status: string;
    message?: string;
  }[];
  containers: {
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: "waiting" | "running" | "terminated";
    stateDetails?: string;
  }[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  creationTimestamp: string;
  ip?: string;
  qosClass?: "Guaranteed" | "Burstable" | "BestEffort";
  resources?: {
    limits?: {
      cpu?: string;
      memory?: string;
    };
    requests?: {
      cpu?: string;
      memory?: string;
    };
  };
}

export type PodStatus =
  | "Running"
  | "Pending"
  | "Succeeded"
  | "Failed"
  | "Unknown"
  | "Terminating"
  | "ContainerCreating"
  | "CrashLoopBackOff"
  | "ImagePullBackOff"
  | "ErrImagePull"
  | "CreateContainerError";

export interface Namespace {
  name: string;
  uid: string;
  status: "Active" | "Terminating";
  labels: Record<string, string>;
  annotations: Record<string, string>;
  creationTimestamp: string;
}

export interface ClusterInfo {
  name: string;
  version: string;
  platform: string;
  apiServerUrl?: string;
}

export interface ClusterMetrics {
  nodeCount: number;
  podCount: number;
  namespaceCount: number;
  nodesByStatus: Record<string, number>;
  podsByStatus: Record<string, number>;
  timestamp: string;
}

export interface ClusterState {
  nodes: KubernetesNode[];
  pods: Pod[];
  namespaces: Namespace[];
  metrics: ClusterMetrics;
  clusterInfo?: ClusterInfo;
}

export interface WatchEvent<T> {
  type: "ADDED" | "MODIFIED" | "DELETED";
  object: T;
}

export interface WebSocketMessage {
  type:
    | "state"
    | "event"
    | "ping"
    | "pong"
    | "error"
    | "node_event"
    | "pod_event"
    | "namespace_event"
    | "metrics";
  data?: unknown;
  action?: string;
  timestamp?: string;
}

export interface StateUpdate {
  nodes?: KubernetesNode[];
  pods?: Pod[];
  namespaces?: Namespace[];
  metrics?: ClusterMetrics;
  clusterInfo?: ClusterInfo;
}

export interface EventMessage {
  eventType: "node" | "pod" | "namespace";
  action: "added" | "modified" | "deleted";
  resource: KubernetesNode | Pod | Namespace;
}
