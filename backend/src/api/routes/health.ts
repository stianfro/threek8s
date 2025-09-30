import { Router, Request, Response } from "express";
import { KubernetesService } from "../../services/KubernetesService";
import { StateManager } from "../../services/StateManager";

export function createHealthRouter(
  kubernetesService: KubernetesService,
  stateManager: StateManager,
): Router {
  const router = Router();

  router.get("/health", async (req: Request, res: Response) => {
    try {
      const isConnected = kubernetesService.isConnected();
      const metrics = stateManager.getMetrics();

      const healthStatus = {
        status: isConnected ? "healthy" : "degraded",
        cluster: {
          connected: isConnected,
          name: isConnected ? "cluster" : null,
          version: null,
        },
        metrics: {
          nodes: metrics.totalNodes,
          readyNodes: metrics.readyNodes,
          pods: metrics.totalPods,
          runningPods: metrics.runningPods,
        },
        timestamp: new Date().toISOString(),
      };

      // Try to get cluster info if connected
      if (isConnected) {
        try {
          const clusterInfo = await kubernetesService.getClusterInfo();
          healthStatus.cluster.name = clusterInfo.name;
          healthStatus.cluster.version = clusterInfo.version;
        } catch (error) {
          console.error("Failed to get cluster info for health check:", error);
        }
      }

      res.status(200).json(healthStatus);
    } catch (error) {
      console.error("Health check error:", error);
      res.status(503).json({
        status: "unhealthy",
        error: "Health check failed",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  return router;
}
