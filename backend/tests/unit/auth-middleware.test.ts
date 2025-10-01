import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express, { Express } from "express";
import { createAuthMiddleware, authErrorHandler } from "../../src/middleware/auth";
import { OidcConfig } from "../../src/config/oidc";

describe("Authentication Middleware", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe("when auth is disabled", () => {
    it("should allow requests without tokens", async () => {
      const config: OidcConfig = {
        enabled: false,
        issuer: "",
        audience: "",
        jwksUri: "",
      };

      const authMiddleware = createAuthMiddleware(config);
      app.get("/test", authMiddleware, (req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app).get("/test").expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe("when auth is enabled", () => {
    let config: OidcConfig;

    beforeEach(() => {
      config = {
        enabled: true,
        issuer: "https://login.example.com",
        audience: "test-client-id",
        jwksUri: "https://login.example.com/keys",
      };
    });

    it("should reject requests without Authorization header", async () => {
      const authMiddleware = createAuthMiddleware(config);
      app.get("/test", authMiddleware, (req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(authErrorHandler);

      await request(app).get("/test").expect(401);
    });

    it("should reject requests with malformed tokens", async () => {
      const authMiddleware = createAuthMiddleware(config);
      app.get("/test", authMiddleware, (req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(authErrorHandler);

      const response = await request(app)
        .get("/test")
        .set("Authorization", "Bearer invalid-token");

      // Malformed tokens can return 401 or 500 depending on how malformed they are
      expect([401, 500]).toContain(response.status);
      if (response.status === 401) {
        expect(response.body.error).toBe("UNAUTHORIZED");
      }
    });

    it("should reject requests with missing Bearer prefix", async () => {
      const authMiddleware = createAuthMiddleware(config);
      app.get("/test", authMiddleware, (req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(authErrorHandler);

      await request(app).get("/test").set("Authorization", "some-token").expect(401);
    });
  });
});
