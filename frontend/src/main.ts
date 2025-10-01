import "./style.css";
import { SceneManager } from "./scene/SceneManager";
import { VisualizationManager } from "./visualization/VisualizationManager";
import { WebSocketService } from "./services/WebSocketService";
import { ApiService } from "./services/ApiService";
import { StateManager } from "./services/StateManager";
import { AuthService } from "./services/AuthService";
import type { StateUpdate, EventMessage } from "./types/kubernetes";
import { loadRuntimeConfig } from "./config/runtime";

// Create main app
async function initApp() {
  // Load runtime configuration first
  const config = await loadRuntimeConfig();
  const API_URL = config.apiUrl;
  const WS_URL = config.wsUrl;

  console.log("Using configuration:", { API_URL, WS_URL });

  // Check if we're handling an OAuth callback
  if (config.authEnabled && window.location.pathname === "/callback") {
    await handleOAuthCallback(config);
    return;
  }

  // Initialize auth service
  const authService = new AuthService({
    enabled: config.authEnabled,
    authority: config.oidcAuthority || "",
    clientId: config.oidcClientId || "",
    redirectUri: config.oidcRedirectUri || `${window.location.origin}/callback`,
    scope: config.oidcScope || "openid profile email",
  });

  // Initialize auth if enabled
  if (config.authEnabled) {
    const user = await authService.initialize();
    if (!user || user.expired) {
      // Not authenticated, redirect to login
      console.log("Not authenticated, redirecting to login");
      showLoginScreen(authService);
      return;
    }
    console.log("User authenticated:", user.profile);
  }
  // Create container
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) {
    console.error("App container not found");
    return;
  }

  // Setup HTML structure
  app.innerHTML = `
    <div id="viewport" class="viewport"></div>
    <div class="ui-overlay">
      <div class="status-bar">
        <div class="connection-status">
          <span class="status-indicator disconnected"></span>
          <span class="status-text">Connecting...</span>
        </div>
        <div class="cluster-info">
          <span class="cluster-name">--</span>
          <span class="cluster-metrics">
            Nodes: <span id="node-count">0</span> |
            Pods: <span id="pod-count">0</span>
          </span>
        </div>
      </div>
      <div class="tooltip" id="tooltip" style="display: none;"></div>
    </div>
  `;

  // Get viewport container
  const viewport = document.getElementById("viewport");
  if (!viewport) {
    console.error("Viewport not found");
    return;
  }

  // Initialize managers and services
  const sceneManager = new SceneManager(viewport);
  const visualizationManager = new VisualizationManager(sceneManager);
  const stateManager = new StateManager();
  const apiService = new ApiService(API_URL);
  const wsService = new WebSocketService({ url: WS_URL });

  // Set access token providers if auth is enabled
  if (config.authEnabled && authService) {
    apiService.setAccessTokenProvider(() => authService.getAccessToken());
    wsService.setAccessTokenProvider(() => authService.getAccessToken());
  }

  // Set up state change listener
  stateManager.onStateChange((state) => {
    console.log("[Main] State changed, updating visualization");
    visualizationManager.updateState(state);
    updateUIMetrics(state);
    // Force re-render
    sceneManager.forceRender();
  });

  // Set up WebSocket event handlers
  wsService.onStateUpdate((update: StateUpdate) => {
    console.log("[Main] WebSocket state update received");
    stateManager.updateFullState(update);
  });

  wsService.onEvent((event: EventMessage) => {
    console.log("[Main] WebSocket event:", event.eventType, event.action);
    switch (event.eventType) {
      case "node":
        stateManager.handleNodeEvent(event.action, event.resource as any);
        break;
      case "pod":
        stateManager.handlePodEvent(event.action, event.resource as any);
        break;
      case "namespace":
        stateManager.handleNamespaceEvent(event.action, event.resource as any);
        break;
    }
  });

  wsService.onStatusChange((status) => {
    console.log("[Main] WebSocket status:", status);
    updateConnectionStatus(status);
  });

  wsService.onError((error) => {
    showError(error.message);
  });

  // Set up interaction handlers
  viewport.addEventListener("mousemove", (e) => visualizationManager.handleMouseMove(e));
  viewport.addEventListener("click", (e) => visualizationManager.handleClick(e));
  viewport.addEventListener("dblclick", (e) => visualizationManager.handleDoubleClick(e));

  // Start animation loop
  sceneManager.start();

  function animate() {
    requestAnimationFrame(animate);
    visualizationManager.animate();
  }
  animate();

  // Load initial state from API
  try {
    showLoadingScreen(true);

    // Check health first
    const health = await apiService.getHealth();
    console.log("API health:", health);

    // Get cluster info
    const clusterInfo = await apiService.getClusterInfo();
    stateManager.updateClusterInfo(clusterInfo);
    updateClusterInfo(clusterInfo);

    // Get initial state
    const initialState = await apiService.getClusterState();
    stateManager.updateFullState(initialState);

    // Connect WebSocket for live updates
    wsService.connect();

    showLoadingScreen(false);
    console.log("ThreeK8s initialized successfully");
  } catch (error) {
    console.error("Failed to initialize:", error);
    showLoadingScreen(false);
    showError("Failed to connect to backend. Please check if the server is running.");
  }
}

// UI Update functions
function updateConnectionStatus(status: string) {
  const indicator = document.querySelector(".status-indicator");
  const text = document.querySelector(".status-text");

  if (indicator) {
    indicator.className = `status-indicator ${status}`;
  }

  if (text) {
    const statusTexts: Record<string, string> = {
      connecting: "Connecting...",
      connected: "Connected",
      disconnected: "Disconnected",
      error: "Connection Error",
    };
    text.textContent = statusTexts[status] || "Unknown";
  }
}

function updateClusterInfo(info: any) {
  const nameElement = document.querySelector(".cluster-name");
  if (nameElement) {
    nameElement.textContent = info.name || "Unknown Cluster";
  }
}

function updateUIMetrics(state: any) {
  const nodeCount = document.getElementById("node-count");
  const podCount = document.getElementById("pod-count");

  if (nodeCount) {
    nodeCount.textContent = state.metrics?.nodeCount?.toString() || "0";
  }

  if (podCount) {
    podCount.textContent = state.metrics?.podCount?.toString() || "0";
  }
}

function showLoadingScreen(show: boolean) {
  let loadingScreen = document.querySelector(".loading-screen");

  if (show && !loadingScreen) {
    loadingScreen = document.createElement("div");
    loadingScreen.className = "loading-screen";
    loadingScreen.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">Connecting to Kubernetes cluster...</div>
    `;
    document.body.appendChild(loadingScreen);
  } else if (!show && loadingScreen) {
    loadingScreen.remove();
  }
}

function showError(message: string) {
  const existingError = document.querySelector(".error-message");
  if (existingError) {
    existingError.remove();
  }

  const errorElement = document.createElement("div");
  errorElement.className = "error-message";
  errorElement.textContent = message;
  document.body.appendChild(errorElement);

  setTimeout(() => {
    errorElement.remove();
  }, 5000);
}

// Helper function to handle OAuth callback
async function handleOAuthCallback(config: any) {
  console.log("Handling OAuth callback");

  const authService = new AuthService({
    enabled: config.authEnabled,
    authority: config.oidcAuthority || "",
    clientId: config.oidcClientId || "",
    redirectUri: config.oidcRedirectUri || `${window.location.origin}/callback`,
    scope: config.oidcScope || "openid profile email",
  });

  try {
    await authService.handleCallback();
    // Redirect to root after successful authentication
    window.location.href = "/";
  } catch (error) {
    console.error("OAuth callback error:", error);
    document.body.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <h1>Authentication Error</h1>
        <p>Failed to complete authentication. Please try again.</p>
        <button onclick="window.location.href='/'">Return to Home</button>
      </div>
    `;
  }
}

// Helper function to show login screen
function showLoginScreen(authService: AuthService) {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  app.innerHTML = `
    <div class="login-screen">
      <div class="login-container">
        <h1>ThreeK8s</h1>
        <p>3D Kubernetes Cluster Visualization</p>
        <button id="login-btn" class="login-button">Sign In</button>
      </div>
    </div>
  `;

  const loginBtn = document.getElementById("login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      authService.login().catch((error) => {
        console.error("Login failed:", error);
        showError("Login failed. Please try again.");
      });
    });
  }
}

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
