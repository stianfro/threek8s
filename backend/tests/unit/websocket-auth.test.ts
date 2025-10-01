import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, Server as HttpServer } from "http";
import { WebSocketManager } from "../../src/services/WebSocketManager";
import { TokenValidator } from "../../src/services/TokenValidator";
import { OidcConfig } from "../../src/config/oidc";

describe("WebSocket Authentication", () => {
  let server: HttpServer;
  let wsManager: WebSocketManager;

  beforeEach(() => {
    server = createServer();
  });

  afterEach(async () => {
    if (wsManager) {
      wsManager.stop();
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe("when auth is disabled", () => {
    it("should accept connections without tokens", async () => {
      const config: OidcConfig = {
        enabled: false,
        issuer: "",
        audience: "",
        jwksUri: "",
      };

      const tokenValidator = new TokenValidator(config);
      wsManager = new WebSocketManager(server, 30000, 10000, tokenValidator);

      const connectionPromise = new Promise<string>((resolve, reject) => {
        wsManager.on("clientConnected", ({ clientId }) => {
          resolve(clientId);
        });
      });

      await new Promise<void>((resolve) => server.listen(0, () => resolve()));

      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        const WebSocket = require("ws");
        const ws = new WebSocket(`ws://localhost:${port}/ws`);

        const clientId = await connectionPromise;
        expect(clientId).toBeDefined();
        expect(wsManager.getClientCount()).toBe(1);

        // Wait for WebSocket to be open before closing
        await new Promise<void>((resolve) => {
          if (ws.readyState === WebSocket.OPEN) {
            resolve();
          } else {
            ws.on("open", () => resolve());
          }
        });

        ws.close();
      }
    });
  });

  describe("when auth is enabled", () => {
    it("should reject connections without tokens", async () => {
      const config: OidcConfig = {
        enabled: true,
        issuer: "https://example.com",
        audience: "test-client",
        jwksUri: "https://example.com/.well-known/jwks.json",
      };

      const tokenValidator = new TokenValidator(config);
      wsManager = new WebSocketManager(server, 30000, 10000, tokenValidator);

      await new Promise<void>((resolve) => server.listen(0, () => resolve()));

      const address = server.address();
      if (address && typeof address === "object") {
        const port = address.port;
        const WebSocket = require("ws");
        const ws = new WebSocket(`ws://localhost:${port}/ws`);

        const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
          ws.on("close", (code: number, reason: Buffer) => {
            resolve({ code, reason: reason.toString() });
          });
        });

        const { code, reason } = await closePromise;
        expect(code).toBe(1008); // Policy violation
        expect(reason).toContain("Authentication failed");
      }
    });
  });
});
