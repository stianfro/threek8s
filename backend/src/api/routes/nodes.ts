import { Router, Request, Response } from 'express';
import { StateManager } from '../../services/StateManager';

export function createNodesRouter(stateManager: StateManager): Router {
  const router = Router();

  router.get('/nodes', (req: Request, res: Response) => {
    try {
      const nodes = stateManager.getNodes();

      // Transform nodes for API response
      const apiNodes = nodes.map(node => ({
        name: node.name,
        uid: node.uid,
        status: node.status,
        role: node.role,
        capacity: node.capacity,
        allocatable: node.allocatable,
        conditions: node.conditions,
        labels: node.labels,
        creationTimestamp: node.creationTimestamp,
        podCount: stateManager.getPodsByNode(node.name).length
      }));

      res.json(apiNodes);
    } catch (error) {
      console.error('Failed to get nodes:', error);
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Failed to retrieve nodes',
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  router.get('/nodes/:nodeName', (req: Request, res: Response) => {
    try {
      const { nodeName } = req.params;
      const nodes = stateManager.getNodes();
      const node = nodes.find(n => n.name === nodeName);

      if (!node) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: `Node ${nodeName} not found`
        });
      }

      // Include pods running on this node
      const pods = stateManager.getPodsByNode(nodeName);

      res.json({
        ...node,
        podCount: pods.length,
        pods: pods.map(pod => ({
          name: pod.name,
          namespace: pod.namespace,
          status: pod.status,
          phase: pod.phase
        }))
      });
    } catch (error) {
      console.error(`Failed to get node ${req.params.nodeName}:`, error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to retrieve node details',
        details: error instanceof Error ? error.message : undefined
      });
    }
  });

  return router;
}