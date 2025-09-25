import { KubernetesNode, Pod, ClusterState, Container } from '../types/kubernetes.js';
import { EventEmitter } from 'events';

export interface MockConfig {
  nodeCount: number;
  podCount: number;
  enableDynamicUpdates?: boolean;
  updateInterval?: number;
}

export class MockDataService extends EventEmitter {
  private config: MockConfig;
  private nodes: Map<string, KubernetesNode> = new Map();
  private pods: Map<string, Pod> = new Map();
  private updateTimer?: NodeJS.Timeout;

  constructor(config: MockConfig) {
    super();
    this.config = {
      enableDynamicUpdates: false,
      updateInterval: 5000,
      ...config
    };
    this.generateInitialData();

    if (this.config.enableDynamicUpdates) {
      this.startDynamicUpdates();
    }
  }

  private generateInitialData(): void {
    // Generate nodes
    for (let i = 0; i < this.config.nodeCount; i++) {
      const node = this.generateMockNode(i);
      this.nodes.set(node.uid, node);
    }

    // Generate pods and distribute evenly across nodes
    const nodeArray = Array.from(this.nodes.values());
    const podsPerNode = Math.floor(this.config.podCount / this.config.nodeCount);
    const remainingPods = this.config.podCount % this.config.nodeCount;

    let podIndex = 0;
    nodeArray.forEach((node, nodeIndex) => {
      const podCountForNode = podsPerNode + (nodeIndex < remainingPods ? 1 : 0);

      for (let i = 0; i < podCountForNode; i++) {
        const pod = this.generateMockPod(podIndex, node.name);
        this.pods.set(pod.uid, pod);
        podIndex++;
      }
    });

    console.log(`[MockDataService] Generated ${this.nodes.size} nodes and ${this.pods.size} pods`);
  }

  private generateMockNode(index: number): KubernetesNode {
    const nodeTypes = ['master', 'worker'];
    const statuses = ['Ready', 'Ready', 'Ready', 'NotReady', 'Unknown']; // 60% Ready

    return {
      uid: `node-uid-${index}`,
      name: `mock-node-${index + 1}`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      role: index === 0 ? 'master' : nodeTypes[Math.floor(Math.random() * nodeTypes.length)],
      kubeletVersion: 'v1.30.5',
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      capacity: {
        cpu: `${4 + Math.floor(Math.random() * 12)}`,
        memory: `${8 + Math.floor(Math.random() * 56)}Gi`,
        pods: `${110 + Math.floor(Math.random() * 50)}`
      },
      allocatable: {
        cpu: `${3 + Math.floor(Math.random() * 10)}`,
        memory: `${7 + Math.floor(Math.random() * 48)}Gi`,
        pods: `${100 + Math.floor(Math.random() * 40)}`
      },
      conditions: [
        {
          type: 'Ready',
          status: 'True',
          reason: 'KubeletReady',
          message: 'kubelet is posting ready status'
        }
      ],
      addresses: [
        {
          type: 'InternalIP',
          address: `10.0.${index + 1}.${Math.floor(Math.random() * 254) + 1}`
        },
        {
          type: 'Hostname',
          address: `mock-node-${index + 1}`
        }
      ]
    };
  }

  private generateMockPod(index: number, nodeName: string): Pod {
    const namespaces = ['default', 'kube-system', 'monitoring', 'production', 'staging'];
    const appTypes = ['web', 'api', 'database', 'cache', 'worker', 'proxy'];
    const statuses = ['Running', 'Running', 'Running', 'Pending', 'Failed', 'Unknown']; // 50% Running

    const namespace = namespaces[Math.floor(Math.random() * namespaces.length)];
    const appType = appTypes[Math.floor(Math.random() * appTypes.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      uid: `pod-uid-${index}`,
      name: `${appType}-${Math.random().toString(36).substring(7)}`,
      namespace,
      nodeName,
      status,
      phase: status === 'Running' ? 'Running' : status === 'Pending' ? 'Pending' : 'Failed',
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      containers: this.generateMockContainers(appType, status),
      ip: status === 'Running' ? `172.16.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` : undefined,
      labels: {
        app: appType,
        environment: namespace === 'production' ? 'prod' : namespace === 'staging' ? 'staging' : 'dev',
        version: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`
      }
    };
  }

  private generateMockContainers(appType: string, podStatus: string): Container[] {
    const containerCount = Math.floor(Math.random() * 3) + 1; // 1-3 containers
    const containers: Container[] = [];

    for (let i = 0; i < containerCount; i++) {
      const containerState = podStatus === 'Running' ? 'running' :
                            podStatus === 'Pending' ? 'waiting' : 'terminated';

      containers.push({
        name: i === 0 ? appType : `${appType}-sidecar-${i}`,
        image: `mock-registry/${appType}:latest`,
        state: containerState,
        ready: containerState === 'running',
        restartCount: Math.floor(Math.random() * 5),
        started: containerState === 'running'
      });
    }

    return containers;
  }

  private startDynamicUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.performRandomUpdate();
    }, this.config.updateInterval);
  }

  private performRandomUpdate(): void {
    const updateTypes = ['podStatus', 'nodeStatus', 'addPod', 'removePod'];
    const updateType = updateTypes[Math.floor(Math.random() * updateTypes.length)];

    switch (updateType) {
      case 'podStatus':
        this.updateRandomPodStatus();
        break;
      case 'nodeStatus':
        this.updateRandomNodeStatus();
        break;
      case 'addPod':
        if (this.pods.size < this.config.podCount * 1.2) {
          this.addRandomPod();
        }
        break;
      case 'removePod':
        if (this.pods.size > this.config.podCount * 0.8) {
          this.removeRandomPod();
        }
        break;
    }

    this.emit('update', this.getState());
  }

  private updateRandomPodStatus(): void {
    const podArray = Array.from(this.pods.values());
    if (podArray.length === 0) return;

    const pod = podArray[Math.floor(Math.random() * podArray.length)];
    const statuses = ['Running', 'Pending', 'Failed'];
    const newStatus = statuses[Math.floor(Math.random() * statuses.length)];

    if (pod.status !== newStatus) {
      pod.status = newStatus;
      pod.phase = newStatus === 'Running' ? 'Running' : newStatus === 'Pending' ? 'Pending' : 'Failed';
      pod.containers.forEach(container => {
        container.state = newStatus === 'Running' ? 'running' :
                         newStatus === 'Pending' ? 'waiting' : 'terminated';
        container.ready = container.state === 'running';
      });

      console.log(`[MockDataService] Updated pod ${pod.name} status to ${newStatus}`);
      this.emit('podUpdate', pod);
    }
  }

  private updateRandomNodeStatus(): void {
    const nodeArray = Array.from(this.nodes.values());
    if (nodeArray.length === 0) return;

    const node = nodeArray[Math.floor(Math.random() * nodeArray.length)];
    const statuses = ['Ready', 'NotReady', 'Unknown'];
    const newStatus = statuses[Math.floor(Math.random() * statuses.length)];

    if (node.status !== newStatus) {
      node.status = newStatus;
      console.log(`[MockDataService] Updated node ${node.name} status to ${newStatus}`);
      this.emit('nodeUpdate', node);
    }
  }

  private addRandomPod(): void {
    const nodeArray = Array.from(this.nodes.values());
    if (nodeArray.length === 0) return;

    const node = nodeArray[Math.floor(Math.random() * nodeArray.length)];
    const newPod = this.generateMockPod(this.pods.size, node.name);
    this.pods.set(newPod.uid, newPod);

    console.log(`[MockDataService] Added new pod ${newPod.name}`);
    this.emit('podAdd', newPod);
  }

  private removeRandomPod(): void {
    const podArray = Array.from(this.pods.values());
    if (podArray.length === 0) return;

    const pod = podArray[Math.floor(Math.random() * podArray.length)];
    this.pods.delete(pod.uid);

    console.log(`[MockDataService] Removed pod ${pod.name}`);
    this.emit('podDelete', pod);
  }

  public getState(): ClusterState {
    return {
      nodes: Array.from(this.nodes.values()),
      pods: Array.from(this.pods.values()),
      namespaces: this.getNamespaces(),
      events: []
    };
  }

  private getNamespaces(): string[] {
    const namespaces = new Set<string>();
    this.pods.forEach(pod => namespaces.add(pod.namespace));
    return Array.from(namespaces);
  }

  public getNodes(): KubernetesNode[] {
    return Array.from(this.nodes.values());
  }

  public getPods(): Pod[] {
    return Array.from(this.pods.values());
  }

  public stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = undefined;
    }
  }
}