import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createHealthRouter } from "./api/routes/health";
import { createClusterRouter } from "./api/routes/cluster";
import { createNodesRouter } from "./api/routes/nodes";
import { createPodsRouter } from "./api/routes/pods";
import { KubernetesService } from "./services/KubernetesService";
import { StateManager } from "./services/StateManager";
import { OidcConfig } from "./config/oidc";
import { createAuthMiddleware, authErrorHandler } from "./middleware/auth";

/**
 * Validate and sanitize CORS origins
 */
function validateCorsOrigins(origins: string[]): string[] {
  const validated = origins
    .map((origin) => origin.trim())
    .filter((origin) => {
      // Reject empty strings
      if (!origin) return false;

      // Warn about wildcards in production
      if (origin === "*" && process.env.NODE_ENV === "production") {
        console.error("SECURITY WARNING: CORS wildcard (*) is not allowed in production");
        return false;
      }

      // Validate origin format
      if (origin !== "*") {
        try {
          // eslint-disable-next-line no-undef
          new URL(origin);
          return true;
        } catch {
          console.warn(`Invalid CORS origin format: ${origin}`);
          return false;
        }
      }

      return true;
    });

  if (validated.length === 0) {
    console.warn("No valid CORS origins configured, using default");
    return ["http://localhost:5173"];
  }

  return validated;
}

export function createApp(
  kubernetesService: KubernetesService,
  stateManager: StateManager,
  oidcConfig: OidcConfig,
): Express {
  const app = express();

  // Security headers - Add BEFORE other middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Three.js may need inline styles
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false, // May need to adjust based on Three.js requirements
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );

  // Middleware
  app.use(express.json({ limit: "100kb" })); // Add size limit
  app.use(express.urlencoded({ extended: true, limit: "100kb" }));

  // CORS configuration
  const corsOriginsRaw = process.env.CORS_ORIGINS?.split(",") || ["http://localhost:5173"];
  const corsOrigins = validateCorsOrigins(corsOriginsRaw);

  console.log("Configured CORS origins:", corsOrigins);

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400, // 24 hours
    }),
  );

  // Rate limiting - Add AFTER helmet, BEFORE routes
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later",
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply to all API routes
  app.use("/api/", limiter);

  // Request logging middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function (data) {
      res.send = originalSend;
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
      return res.send(data);
    };

    next();
  });

  // Kubernetes probe endpoints (lightweight, root-level)
  app.get("/health", (req: Request, res: Response) => {
    // Simple liveness check - server is running
    res.status(200).send("OK");
  });

  app.get("/ready", (req: Request, res: Response) => {
    // Readiness check - connected to Kubernetes
    if (kubernetesService.isConnected()) {
      res.status(200).send("Ready");
    } else {
      res.status(503).send("Not Ready");
    }
  });

  // Create auth middleware
  const authMiddleware = createAuthMiddleware(oidcConfig);

  // API routes
  const apiRouter = express.Router();

  // Health endpoint is always public (no auth required)
  apiRouter.use(createHealthRouter(kubernetesService, stateManager));

  // Protected routes (when auth is enabled)
  apiRouter.use(authMiddleware);
  apiRouter.use(createClusterRouter(kubernetesService, stateManager));
  apiRouter.use(createNodesRouter(stateManager));
  apiRouter.use(createPodsRouter(stateManager));

  app.use("/api", apiRouter);

  // Auth error handler (must come after routes)
  app.use(authErrorHandler);

  // Root route
  app.get("/", (req: Request, res: Response) => {
    res.json({
      name: "ThreeK8s API",
      version: "1.0.0",
      description: "Backend API for Kubernetes 3D visualization",
      endpoints: {
        health: "/api/health",
        cluster: "/api/cluster/info",
        nodes: "/api/nodes",
        pods: "/api/pods",
        namespaces: "/api/namespaces",
        websocket: "/ws",
      },
    });
  });

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "NOT_FOUND",
      message: `Endpoint ${req.path} not found`,
      method: req.method,
    });
  });

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error("Express error:", err);
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  });

  return app;
}
