/**
 * Authentication Middleware
 *
 * Provides JWT validation middleware for Express routes.
 * Uses express-jwt with JWKS (JSON Web Key Set) for token verification.
 * Also supports kiosk token authentication.
 */

import { expressjwt, GetVerificationKey } from "express-jwt";
import jwksRsa from "jwks-rsa";
import { Request, Response, NextFunction } from "express";
import { OidcConfig } from "../config/oidc";
import crypto from "crypto";

/**
 * Validate kiosk token using constant-time comparison
 */
function isValidKioskToken(token: string, configToken: string): boolean {
  if (!configToken || !token) {
    return false;
  }

  const configBuffer = Buffer.from(configToken, "utf-8");
  const providedBuffer = Buffer.from(token, "utf-8");

  if (configBuffer.length !== providedBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(configBuffer, providedBuffer);
  } catch (error) {
    return false;
  }
}

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

  // Check if we have kiosk token configured
  const hasKioskAuth = config.kioskAuthToken && config.kioskAuthToken.length > 0;
  const hasOidcConfig = config.jwksUri && config.issuer && config.audience;

  // If only kiosk auth is configured, use simple token validation
  if (hasKioskAuth && !hasOidcConfig) {
    return (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
          error: "UNAUTHORIZED",
          message: "Missing or invalid authorization header",
        });
      }

      const token = authHeader.substring(7);
      if (isValidKioskToken(token, config.kioskAuthToken!)) {
        // Set synthetic auth object
        (req as Request & { auth?: unknown }).auth = {
          sub: "kiosk",
          kiosk_auth: true,
        };
        return next();
      }

      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Invalid authentication token",
      });
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

  // Wrap middleware to support both kiosk and OIDC tokens
  return (req: Request, res: Response, next: NextFunction) => {
    // Check for kiosk token first if configured
    if (hasKioskAuth) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        if (isValidKioskToken(token, config.kioskAuthToken!)) {
          // Set synthetic auth object
          (req as Request & { auth?: unknown }).auth = {
            sub: "kiosk",
            kiosk_auth: true,
          };
          return next();
        }
      }
    }

    // Fall through to OIDC JWT validation
    middleware(req, res, (err) => {
      if (err) {
        return next(err);
      }

      // Manual audience validation for Entra ID tokens
      const auth = (req as Request & { auth?: { aud?: string | string[]; appid?: string } }).auth;
      if (auth) {
        const aud = Array.isArray(auth.aud) ? auth.aud : [auth.aud || ""];
        const appid = auth.appid;

        // Check if audience or appid matches our client ID
        const audienceValid = aud.includes(config.audience) || appid === config.audience;

        if (!audienceValid) {
          const errorDetails =
            process.env.NODE_ENV === "development" ? "Audience validation failed" : undefined;

          console.error(
            `[AUTH] Audience validation failed for token. Expected: ${config.audience}`,
          );

          return res.status(401).json({
            error: "UNAUTHORIZED",
            message: "Invalid token audience",
            details: errorDetails,
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
export function authErrorHandler(
  err: Error & { name?: string },
  req: Request,
  res: Response,
  next: NextFunction,
): void {
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
