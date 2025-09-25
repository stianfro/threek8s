import { KubeConfig, CoreV1Api, VersionApi, Watch } from '@kubernetes/client-node';
import { KubernetesNode } from '../models/KubernetesNode';
import { Pod } from '../models/Pod';
import { Namespace } from '../models/Namespace';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';

export class KubernetesService extends EventEmitter {
  private kubeConfig: KubeConfig;
  private coreApi: CoreV1Api;
  private versionApi: VersionApi;
  private watch: Watch;
  private connected: boolean = false;

  constructor(kubeconfigPath?: string) {
    super();
    this.kubeConfig = new KubeConfig();
    this.watch = new Watch(this.kubeConfig);

    this.loadKubeConfig(kubeconfigPath);
    this.coreApi = this.kubeConfig.makeApiClient(CoreV1Api);
    this.versionApi = this.kubeConfig.makeApiClient(VersionApi);
  }

  private loadKubeConfig(kubeconfigPath?: string): void {
    // Check if running in-cluster
    const inCluster = process.env.KUBERNETES_SERVICE_HOST !== undefined;

    if (inCluster) {
      console.log('KubernetesService: Loading in-cluster config');
      this.kubeConfig.loadFromCluster();
    } else if (kubeconfigPath) {
      const resolvedPath = kubeconfigPath.replace('~', os.homedir());
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        console.log(`KubernetesService: Loading config from file: ${resolvedPath}`);
        this.kubeConfig.loadFromFile(resolvedPath);
      } else {
        throw new Error(`Kubeconfig file not found or is not a file: ${resolvedPath}`);
      }
    } else {
      // Try to load from default location
      console.log('KubernetesService: Loading config from default location');
      this.kubeConfig.loadFromDefault();
    }
  }

  async connect(): Promise<void> {
    try {
      // Test connection by getting version
      const version = await this.versionApi.getCode();
      this.connected = true;
      const versionData = (version as any).body || version;
      this.emit('connected', {
        version: versionData.gitVersion,
        platform: versionData.platform,
      });
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to Kubernetes cluster: ${error}`);
    }
  }

  async getClusterInfo() {
    const version = await this.versionApi.getCode();
    const versionData = (version as any).body || version;
    const currentContext = this.kubeConfig.getCurrentContext();
    const cluster = this.kubeConfig.getCurrentCluster();

    return {
      name: currentContext,
      version: versionData.gitVersion,
      apiServer: cluster?.server,
      platform: versionData.platform,
      connected: this.connected,
    };
  }

  async getNodes(): Promise<KubernetesNode[]> {
    const response = await this.coreApi.listNode();
    const nodes = (response as any).body || response;
    return nodes.items.map((node: any) => this.transformNode(node));
  }

  async getPods(namespace?: string): Promise<Pod[]> {
    let response;
    if (namespace) {
      response = await this.coreApi.listNamespacedPod({ namespace } as any);
    } else {
      response = await this.coreApi.listPodForAllNamespaces();
    }
    const pods = (response as any).body || response;
    return pods.items.map((pod: any) => this.transformPod(pod));
  }

  async getNamespaces(): Promise<Namespace[]> {
    const response = await this.coreApi.listNamespace();
    const nsData = (response as any).body || response;
    const namespaces = nsData.items.map((ns: any) => this.transformNamespace(ns));

    // Count pods per namespace
    const pods = await this.getPods();
    const podCounts = new Map<string, number>();
    pods.forEach(pod => {
      const count = podCounts.get(pod.namespace) || 0;
      podCounts.set(pod.namespace, count + 1);
    });

    namespaces.forEach((ns: any) => {
      ns.podCount = podCounts.get(ns.name) || 0;
    });

    return namespaces;
  }

  private transformNode(node: any): KubernetesNode {
    const conditions = node.status?.conditions || [];
    const readyCondition = conditions.find((c: any) => c.type === 'Ready');
    const role = node.metadata?.labels?.['node-role.kubernetes.io/master'] !== undefined
      ? 'master'
      : node.metadata?.labels?.['node-role.kubernetes.io/control-plane'] !== undefined
      ? 'control-plane'
      : 'worker';

    return {
      name: node.metadata?.name || '',
      uid: node.metadata?.uid || '',
      status: readyCondition?.status === 'True' ? 'Ready' : 'NotReady',
      role,
      capacity: {
        cpu: node.status?.capacity?.cpu || '0',
        memory: node.status?.capacity?.memory || '0',
        pods: node.status?.capacity?.pods || '0',
        storage: node.status?.capacity?.['ephemeral-storage'] || '0',
      },
      allocatable: {
        cpu: node.status?.allocatable?.cpu || '0',
        memory: node.status?.allocatable?.memory || '0',
        pods: node.status?.allocatable?.pods || '0',
        storage: node.status?.allocatable?.['ephemeral-storage'] || '0',
      },
      conditions: conditions.map((c: any) => ({
        type: c.type,
        status: c.status,
        lastTransitionTime: new Date(c.lastTransitionTime),
        reason: c.reason || '',
        message: c.message || '',
      })),
      labels: node.metadata?.labels || {},
      creationTimestamp: new Date(node.metadata?.creationTimestamp),
    };
  }

  private transformPod(pod: any): Pod {
    const phase = pod.status?.phase || 'Unknown';
    const containers = pod.spec?.containers || [];
    const containerStatuses = pod.status?.containerStatuses || [];

    return {
      name: pod.metadata?.name || '',
      uid: pod.metadata?.uid || '',
      namespace: pod.metadata?.namespace || '',
      nodeName: pod.spec?.nodeName || '',
      status: pod.status?.reason || phase,
      phase: phase as Pod['phase'],
      containers: containers.map((container: any, index: number) => {
        const status = containerStatuses[index];
        return {
          name: container.name,
          image: container.image,
          ready: status?.ready || false,
          state: status?.state?.running ? 'running' :
                 status?.state?.waiting ? 'waiting' :
                 status?.state?.terminated ? 'terminated' : 'waiting',
        };
      }),
      labels: pod.metadata?.labels || {},
      annotations: pod.metadata?.annotations || {},
      creationTimestamp: new Date(pod.metadata?.creationTimestamp),
      deletionTimestamp: pod.metadata?.deletionTimestamp
        ? new Date(pod.metadata.deletionTimestamp)
        : undefined,
    };
  }

  private transformNamespace(namespace: any): Namespace {
    return {
      name: namespace.metadata?.name || '',
      uid: namespace.metadata?.uid || '',
      status: namespace.status?.phase === 'Terminating' ? 'Terminating' : 'Active',
      podCount: 0, // Will be updated separately
      labels: namespace.metadata?.labels || {},
      annotations: namespace.metadata?.annotations || {},
      creationTimestamp: new Date(namespace.metadata?.creationTimestamp),
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect(): void {
    this.connected = false;
    this.emit('disconnected');
  }
}