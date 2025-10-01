/**
 * Authentication Middleware
 *
 * Provides JWT validation middleware for Express routes.
 * Uses express-jwt with JWKS (JSON Web Key Set) for token verification.
 */

import { expressjwt, GetVerificationKey } from "express-jwt";
import jwksRsa from "jwks-rsa";
import { Request, Response, NextFunction } from "express";
import { OidcConfig } from "../config/oidc";

/**
 * Create JWT authentication middleware
 *
 * @param config OIDC configuration
 * @returns Express middleware for JWT validation
 */
export function createAuthMiddleware(config: OidcConfig) {
  if (!config.enabled) {
    // Return a no-op middleware when auth is disabled
    return (req: Request, res: Response, next: NextFunction) => {
      next();
    };
  }

  // Configure JWKS client to fetch public keys
  const jwksClient = jwksRsa({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: config.jwksUri,
  });

  const getKey: GetVerificationKey = async (req, token) => {
    if (!token?.header?.kid) {
      throw new Error("No kid in token header");
    }

    return new Promise((resolve, reject) => {
      jwksClient.getSigningKey(token.header.kid!, (err, key) => {
        if (err) {
          reject(err);
          return;
        }
        const signingKey = key?.getPublicKey();
        resolve(signingKey);
      });
    });
  };

  // Create express-jwt middleware
  // Note: For Microsoft Entra ID SPAs, the audience might be Microsoft Graph
  // but the appid claim contains our application ID. We validate manually.
  const middleware = expressjwt({
    secret: getKey,
    issuer: config.issuer,
    algorithms: ["RS256"],
    requestProperty: "auth",
    // Skip audience validation - we'll do it manually for Entra ID compatibility
    credentialsRequired: true,
  });

  // Wrap middleware to add custom audience validation
  return (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, (err) => {
      if (err) {
        return next(err);
      }

      // Manual audience validation for Entra ID tokens
      const auth = (req as any).auth;
      if (auth) {
        const aud = Array.isArray(auth.aud) ? auth.aud : [auth.aud];
        const appid = auth.appid;

        // Check if audience or appid matches our client ID
        const audienceValid = aud.includes(config.audience) || appid === config.audience;

        if (!audienceValid) {
          return res.status(401).json({
            error: "UNAUTHORIZED",
            message: "Invalid token audience",
            details:
              process.env.NODE_ENV === "development"
                ? `Expected: ${config.audience}, Got aud: ${aud.join(", ")}, appid: ${appid}`
                : undefined,
          });
        }
      }

      next();
    });
  };
}

/**
 * Error handler for JWT authentication errors
 */
export function authErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (err.name === "UnauthorizedError") {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Invalid or missing authentication token",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
    return;
  }
  next(err);
}
