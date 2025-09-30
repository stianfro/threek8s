/**
 * Runtime configuration loader
 * Loads configuration from /config.js at runtime instead of build time
 */

export interface RuntimeConfig {
  apiUrl: string;
  wsUrl: string;
}

// Default configuration for development
const defaultConfig: RuntimeConfig = {
  apiUrl: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws",
};

let runtimeConfig: RuntimeConfig | null = null;

/**
 * Load runtime configuration from /config.js
 * This file will be dynamically generated in production
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (runtimeConfig) {
    return runtimeConfig;
  }

  try {
    // In development, use build-time env vars
    if (import.meta.env.DEV) {
      console.log("Using development configuration");
      runtimeConfig = defaultConfig;
      return runtimeConfig;
    }

    // In production, fetch runtime configuration
    const response = await fetch("/config.js");
    if (!response.ok) {
      console.warn("Failed to load runtime config, using defaults");
      runtimeConfig = defaultConfig;
      return runtimeConfig;
    }

    const configText = await response.text();

    // Parse the JavaScript config file
    // Expected format: window.__RUNTIME_CONFIG__ = { apiUrl: '...', wsUrl: '...' }
    const configMatch = configText.match(/window\.__RUNTIME_CONFIG__\s*=\s*({[^}]+})/);
    if (configMatch) {
      try {
        // Use Function constructor for safer eval
        const configObj = new Function("return " + configMatch[1])();
        runtimeConfig = {
          apiUrl: configObj.apiUrl || defaultConfig.apiUrl,
          wsUrl: configObj.wsUrl || defaultConfig.wsUrl,
        };
        console.log("Loaded runtime configuration:", runtimeConfig);
      } catch (e) {
        console.error("Failed to parse runtime config:", e);
        runtimeConfig = defaultConfig;
      }
    } else {
      console.warn("Invalid runtime config format, using defaults");
      runtimeConfig = defaultConfig;
    }
  } catch (error) {
    console.error("Error loading runtime configuration:", error);
    runtimeConfig = defaultConfig;
  }

  return runtimeConfig;
}

/**
 * Get the current runtime configuration
 * Throws error if config hasn't been loaded yet
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (!runtimeConfig) {
    throw new Error("Runtime configuration not loaded. Call loadRuntimeConfig() first.");
  }
  return runtimeConfig;
}
