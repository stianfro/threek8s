import { Router, Request, Response } from 'express';
import { KubernetesService } from '../../services/KubernetesService';
import { StateManager } from '../../services/StateManager';

export function createClusterRouter(
  kubernetesService: KubernetesService,
  stateManager: StateManager
): Router {
  const router = Router();

  router.get('/cluster/info', async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isConnected()) {
        return res.status(503).json({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Not connected to Kubernetes cluster'
        });
      }

      const clusterInfo = await kubernetesService.getClusterInfo();
      const metrics = stateManager.getMetrics();

      res.json({
        ...clusterInfo,
        nodeCount: metrics.totalNodes,
        namespaceCount: stateManager.getNamespaces().length,
        podCount: metrics.totalPods
      });
    } catch (error) {
      console.error('Failed to get cluster info:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve cluster information',
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  router.get('/cluster/state', async (req: Request, res: Response) => {
    try {
      if (!kubernetesService.isConnected()) {
        return res.status(503).json({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Not connected to Kubernetes cluster'
        });
      }

      const state = stateManager.getState();
      const metrics = stateManager.getMetrics();

      res.json({
        nodes: state.nodes,
        pods: state.pods,
        namespaces: state.namespaces,
        metrics: {
          nodeCount: metrics.totalNodes,
          podCount: metrics.totalPods,
          namespaceCount: state.namespaces.length,
          nodesByStatus: metrics.nodesByStatus,
          podsByStatus: metrics.podsByStatus,
          timestamp: new Date().toISOString()
        },
        clusterInfo: await kubernetesService.getClusterInfo()
      });
    } catch (error) {
      console.error('Failed to get cluster state:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve cluster state',
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  router.post('/config/validate', async (req: Request, res: Response) => {
    const { kubeconfigPath } = req.body;

    if (!kubeconfigPath) {
      return res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'kubeconfigPath is required'
      });
    }

    try {
      // Create a temporary service to test the config
      const testService = new KubernetesService(kubeconfigPath);
      await testService.connect();

      const clusterInfo = await testService.getClusterInfo();

      res.json({
        valid: true,
        cluster: clusterInfo.name,
        user: 'current-user', // This would need to be extracted from kubeconfig
        permissions: ['get', 'list', 'watch'], // Simplified for now
        version: clusterInfo.version
      });
    } catch (error) {
      console.error('Kubeconfig validation failed:', error);
      res.status(400).json({
        error: 'INVALID_KUBECONFIG',
        message: 'Failed to validate kubeconfig',
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  return router;
}