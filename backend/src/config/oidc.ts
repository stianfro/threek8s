/**
 * OIDC Configuration
 *
 * Loads and validates OIDC configuration from environment variables.
 * Supports optional authentication that can be enabled/disabled via AUTH_ENABLED.
 */

export interface OidcConfig {
  enabled: boolean;
  issuer: string;
  audience: string;
  jwksUri: string;
}

/**
 * Load OIDC configuration from environment variables
 */
export function loadOidcConfig(): OidcConfig {
  const enabled = process.env.AUTH_ENABLED === "true";

  if (!enabled) {
    console.log("Authentication is disabled (AUTH_ENABLED=false)");
    return {
      enabled: false,
      issuer: "",
      audience: "",
      jwksUri: "",
    };
  }

  const issuer = process.env.OIDC_ISSUER || "";
  const audience = process.env.OIDC_AUDIENCE || "";
  const jwksUri = process.env.OIDC_JWKS_URI || "";

  // Validate required fields when auth is enabled
  if (!issuer || !audience || !jwksUri) {
    throw new Error(
      "OIDC configuration incomplete. When AUTH_ENABLED=true, you must set: OIDC_ISSUER, OIDC_AUDIENCE, OIDC_JWKS_URI",
    );
  }

  console.log("Authentication is enabled");
  console.log(`OIDC Issuer: ${issuer}`);
  console.log(`OIDC Audience: ${audience}`);

  return {
    enabled: true,
    issuer,
    audience,
    jwksUri,
  };
}
