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
  async validateToken(token: string): Promise<jwt.JwtPayload | string> {
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
          issuer: this.config.issuer,
          algorithms: ["RS256"],
          // Skip audience validation in jwt.verify, we'll do it manually
          // to support both aud and appid claims
        },
        (err, decoded) => {
          if (err) {
            reject(new Error(`Token validation failed: ${err.message}`));
            return;
          }

          // Manual audience validation for Entra ID tokens
          if (decoded && typeof decoded === "object") {
            const payload = decoded as jwt.JwtPayload & { appid?: string };
            const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud || ""];
            const appid = payload.appid;

            // Check if audience matches our client ID
            const audienceValid =
              aud.includes(this.config.audience) || appid === this.config.audience;

            if (!audienceValid) {
              reject(
                new Error(
                  `Token audience validation failed. Expected: ${this.config.audience}, Got aud: ${aud.join(", ")}, appid: ${appid}`,
                ),
              );
              return;
            }
          }

          resolve(decoded as jwt.JwtPayload | string);
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
