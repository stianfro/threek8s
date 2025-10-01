import { describe, it, expect } from "vitest";
import { TokenValidator } from "../../src/services/TokenValidator";
import { OidcConfig } from "../../src/config/oidc";

describe("TokenValidator", () => {
  describe("when auth is disabled", () => {
    it("should return system user with auth_disabled flag", async () => {
      const config: OidcConfig = {
        enabled: false,
        issuer: "",
        audience: "",
        jwksUri: "",
      };

      const validator = new TokenValidator(config);
      const result = await validator.validateToken("any-token");

      expect(result).toHaveProperty("sub", "system");
      expect(result).toHaveProperty("auth_disabled", true);
      expect(result).toHaveProperty("timestamp");
    });

    it("should return isAuthEnabled as false", () => {
      const config: OidcConfig = {
        enabled: false,
        issuer: "",
        audience: "",
        jwksUri: "",
      };

      const validator = new TokenValidator(config);
      expect(validator.isAuthEnabled()).toBe(false);
    });
  });

  describe("when auth is enabled", () => {
    it("should return isAuthEnabled as true", () => {
      const config: OidcConfig = {
        enabled: true,
        issuer: "https://example.com",
        audience: "test-client",
        jwksUri: "https://example.com/.well-known/jwks.json",
      };

      const validator = new TokenValidator(config);
      expect(validator.isAuthEnabled()).toBe(true);
    });

    it("should reject invalid token format", async () => {
      const config: OidcConfig = {
        enabled: true,
        issuer: "https://example.com",
        audience: "test-client",
        jwksUri: "https://example.com/.well-known/jwks.json",
      };

      const validator = new TokenValidator(config);

      await expect(validator.validateToken("invalid")).rejects.toThrow();
    });

    it("should reject empty token", async () => {
      const config: OidcConfig = {
        enabled: true,
        issuer: "https://example.com",
        audience: "test-client",
        jwksUri: "https://example.com/.well-known/jwks.json",
      };

      const validator = new TokenValidator(config);

      await expect(validator.validateToken("")).rejects.toThrow("No token provided");
    });
  });
});
