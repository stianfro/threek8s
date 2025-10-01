/**
 * Token Validator Service
 *
 * Validates JWT tokens for WebSocket connections and other non-HTTP contexts.
 * Uses the same JWKS-based validation as the HTTP middleware.
 */

import jwksRsa from "jwks-rsa";
import jwt from "jsonwebtoken";
import { OidcConfig } from "../config/oidc";

export class TokenValidator {
  private jwksClient: jwksRsa.JwksClient | null = null;
  private config: OidcConfig;

  constructor(config: OidcConfig) {
    this.config = config;

    if (config.enabled) {
      this.jwksClient = jwksRsa({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: config.jwksUri,
      });
    }
  }

  /**
   * Validate a JWT token
   *
   * @param token JWT token string
   * @returns Decoded token payload if valid
   * @throws Error if token is invalid or auth is disabled
   */
  async validateToken(token: string): Promise<any> {
    if (!this.config.enabled) {
      // When auth is disabled, we still return a valid result but log a warning
      console.warn("Token validation called but auth is disabled");
      return { sub: "anonymous" };
    }

    if (!token) {
      throw new Error("No token provided");
    }

    // Decode token header to get kid
    const decodedHeader = jwt.decode(token, { complete: true });
    if (!decodedHeader || typeof decodedHeader === "string") {
      throw new Error("Invalid token format");
    }

    const kid = decodedHeader.header.kid;
    if (!kid) {
      throw new Error("Token missing kid in header");
    }

    // Get signing key from JWKS
    const key = await this.getSigningKey(kid);

    // Verify token
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        key,
        {
          audience: this.config.audience,
          issuer: this.config.issuer,
          algorithms: ["RS256"],
        },
        (err, decoded) => {
          if (err) {
            reject(new Error(`Token validation failed: ${err.message}`));
          } else {
            resolve(decoded);
          }
        },
      );
    });
  }

  /**
   * Get signing key from JWKS
   */
  private async getSigningKey(kid: string): Promise<string> {
    if (!this.jwksClient) {
      throw new Error("JWKS client not initialized");
    }

    return new Promise((resolve, reject) => {
      this.jwksClient!.getSigningKey(kid, (err, key) => {
        if (err) {
          reject(err);
        } else {
          const signingKey = key?.getPublicKey();
          if (!signingKey) {
            reject(new Error("No signing key found"));
          } else {
            resolve(signingKey);
          }
        }
      });
    });
  }

  /**
   * Check if authentication is enabled
   */
  isAuthEnabled(): boolean {
    return this.config.enabled;
  }
}
