import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createHealthRouter } from './api/routes/health';
import { createClusterRouter } from './api/routes/cluster';
import { createNodesRouter } from './api/routes/nodes';
import { createPodsRouter } from './api/routes/pods';
import { KubernetesService } from './services/KubernetesService';
import { StateManager } from './services/StateManager';

export function createApp(
  kubernetesService: KubernetesService,
  stateManager: StateManager
): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS configuration
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'];
  app.use(cors({
    origin: corsOrigins,
    credentials: true
  }));

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function(data) {
      res.send = originalSend;
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      return res.send(data);
    };

    next();
  });

  // Kubernetes probe endpoints (lightweight, root-level)
  app.get('/health', (req: Request, res: Response) => {
    // Simple liveness check - server is running
    res.status(200).send('OK');
  });

  app.get('/ready', (req: Request, res: Response) => {
    // Readiness check - connected to Kubernetes
    if (kubernetesService.isConnected()) {
      res.status(200).send('Ready');
    } else {
      res.status(503).send('Not Ready');
    }
  });

  // API routes
  const apiRouter = express.Router();

  apiRouter.use(createHealthRouter(kubernetesService, stateManager));
  apiRouter.use(createClusterRouter(kubernetesService, stateManager));
  apiRouter.use(createNodesRouter(stateManager));
  apiRouter.use(createPodsRouter(stateManager));

  app.use('/api', apiRouter);

  // Root route
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'ThreeK8s API',
      version: '1.0.0',
      description: 'Backend API for Kubernetes 3D visualization',
      endpoints: {
        health: '/api/health',
        cluster: '/api/cluster/info',
        nodes: '/api/nodes',
        pods: '/api/pods',
        namespaces: '/api/namespaces',
        websocket: '/ws'
      }
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: `Endpoint ${req.path} not found`,
      method: req.method
    });
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Express error:', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  return app;
}