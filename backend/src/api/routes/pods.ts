import { Router, Request, Response } from 'express';
import { StateManager } from '../../services/StateManager';

export function createPodsRouter(stateManager: StateManager): Router {
  const router = Router();

  router.get('/pods', (req: Request, res: Response) => {
    try {
      const { namespace, node, phase } = req.query;
      let pods = stateManager.getPods();

      // Apply filters
      if (namespace) {
        pods = pods.filter(pod => pod.namespace === namespace);
      }

      if (node) {
        pods = pods.filter(pod => pod.nodeName === node);
      }

      if (phase) {
        pods = pods.filter(pod => pod.phase === phase);
      }

      // Transform pods for API response
      const apiPods = pods.map(pod => ({
        name: pod.name,
        uid: pod.uid,
        namespace: pod.namespace,
        nodeName: pod.nodeName,
        phase: pod.phase,
        status: pod.status,
        containers: pod.containers,
        labels: pod.labels,
        creationTimestamp: pod.creationTimestamp,
        deletionTimestamp: pod.deletionTimestamp
      }));

      res.json(apiPods);
    } catch (error) {
      console.error('Failed to get pods:', error);
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Failed to retrieve pods',
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  router.get('/pods/:namespace/:podName', (req: Request, res: Response) => {
    try {
      const { namespace, podName } = req.params;
      const pods = stateManager.getPods();
      const pod = pods.find(p => p.namespace === namespace && p.name === podName);

      if (!pod) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Pod ${podName} not found in namespace ${namespace}`
        });
      }

      res.json(pod);
    } catch (error) {
      console.error(`Failed to get pod ${req.params.podName}:`, error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve pod details',
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  router.get('/namespaces', (req: Request, res: Response) => {
    try {
      const namespaces = stateManager.getNamespaces();

      const apiNamespaces = namespaces.map(ns => ({
        name: ns.name,
        uid: ns.uid,
        status: ns.status,
        podCount: ns.podCount,
        labels: ns.labels,
        creationTimestamp: ns.creationTimestamp
      }));

      res.json(apiNamespaces);
    } catch (error) {
      console.error('Failed to get namespaces:', error);
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Failed to retrieve namespaces',
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  return router;
}