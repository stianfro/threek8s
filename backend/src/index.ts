import dotenv from "dotenv";
import { createServer, Server } from "http";
import { KubeConfig } from "@kubernetes/client-node";
import { createApp } from "./app";
import { KubernetesService } from "./services/KubernetesService";
import { WatchManager } from "./services/WatchManager";
import { StateManager } from "./services/StateManager";
import { WebSocketManager } from "./services/WebSocketManager";
import { EventProcessor } from "./services/EventProcessor";
import { loadOidcConfig } from "./config/oidc";
import { TokenValidator } from "./services/TokenValidator";

// Load environment variables
dotenv.config();

// Configuration
const PORT = parseInt(process.env.PORT || "3001", 10);
const KUBECONFIG_PATH = process.env.KUBECONFIG_PATH;
const WS_HEARTBEAT_INTERVAL = parseInt(process.env.WS_HEARTBEAT_INTERVAL || "30000", 10);
const WS_HEARTBEAT_TIMEOUT = parseInt(process.env.WS_HEARTBEAT_TIMEOUT || "10000", 10);

async function startServer() {
  try {
    console.log("Starting ThreeK8s backend...");

    // Load OIDC configuration
    const oidcConfig = loadOidcConfig();

    // Initialize token validator
    const tokenValidator = new TokenValidator(oidcConfig);

    // Initialize Kubernetes configuration
    const kubeConfig = new KubeConfig();

    // Check if running in-cluster (presence of service account token)
    const inCluster = process.env.KUBERNETES_SERVICE_HOST !== undefined;

    if (inCluster) {
      console.log("Detected in-cluster environment, using service account");
      kubeConfig.loadFromCluster();
    } else if (KUBECONFIG_PATH) {
      console.log(`Loading kubeconfig from: ${KUBECONFIG_PATH}`);
      kubeConfig.loadFromFile(KUBECONFIG_PATH.replace("~", process.env.HOME || ""));
    } else {
      console.log("Loading kubeconfig from default location");
      kubeConfig.loadFromDefault();
    }

    // Initialize services
    const kubernetesService = new KubernetesService(KUBECONFIG_PATH);
    const stateManager = new StateManager();
    const watchManager = new WatchManager(kubeConfig);

    // Create Express app
    const app = createApp(kubernetesService, stateManager, oidcConfig);

    // Create HTTP server
    const server = createServer(app);

    // Initialize WebSocket manager with token validator
    const webSocketManager = new WebSocketManager(
      server,
      WS_HEARTBEAT_INTERVAL,
      WS_HEARTBEAT_TIMEOUT,
      tokenValidator,
    );

    // Initialize event processor
    const eventProcessor = new EventProcessor(
      kubernetesService,
      watchManager,
      stateManager,
      webSocketManager,
    );

    // Connect to Kubernetes cluster
    console.log("Connecting to Kubernetes cluster...");
    await kubernetesService.connect();

    const clusterInfo = await kubernetesService.getClusterInfo();
    console.log(`Connected to cluster: ${clusterInfo.name} (${clusterInfo.version})`);
    stateManager.setConnectionStatus("Connected");
    stateManager.setClusterInfo(clusterInfo);

    // Initialize event processor (loads initial state and starts watching)
    console.log("Initializing event processor...");
    await eventProcessor.initialize();

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws`);
      console.log(`🎯 API endpoints: http://localhost:${PORT}/api`);
    });

    // Graceful shutdown
    process.on("SIGTERM", () => shutdown(server, eventProcessor, watchManager, webSocketManager));
    process.on("SIGINT", () => shutdown(server, eventProcessor, watchManager, webSocketManager));
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

function shutdown(
  server: Server,
  eventProcessor: EventProcessor,
  watchManager: WatchManager,
  webSocketManager: WebSocketManager,
) {
  console.log("\nShutting down server...");

  // Stop processing events
  eventProcessor.stop();

  // Stop watching
  watchManager.stopWatching();

  // Close WebSocket connections
  webSocketManager.stop();

  // Close HTTP server
  server.close(() => {
    console.log("Server shut down gracefully");
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

// Start the server
startServer().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
