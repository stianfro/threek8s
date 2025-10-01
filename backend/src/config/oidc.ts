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
  kioskAuthToken?: string;
}

/**
 * Load OIDC configuration from environment variables
 */
export function loadOidcConfig(): OidcConfig {
  const enabled = process.env.AUTH_ENABLED === "true";
  const kioskAuthToken = process.env.KIOSK_AUTH_TOKEN;

  if (!enabled) {
    console.log("Authentication is disabled (AUTH_ENABLED=false)");
    return {
      enabled: false,
      issuer: "",
      audience: "",
      jwksUri: "",
      kioskAuthToken,
    };
  }

  const issuer = process.env.OIDC_ISSUER || "";
  const audience = process.env.OIDC_AUDIENCE || "";
  const jwksUri = process.env.OIDC_JWKS_URI || "";

  // Check if either OIDC or kiosk auth is configured
  const hasOidcConfig = issuer && audience && jwksUri;
  const hasKioskAuth = kioskAuthToken && kioskAuthToken.length > 0;

  if (!hasOidcConfig && !hasKioskAuth) {
    throw new Error(
      "Authentication configuration incomplete. When AUTH_ENABLED=true, you must set either: " +
        "(OIDC_ISSUER, OIDC_AUDIENCE, OIDC_JWKS_URI) or KIOSK_AUTH_TOKEN",
    );
  }

  console.log("Authentication is enabled");
  if (hasOidcConfig) {
    console.log(`OIDC Issuer: ${issuer}`);
    console.log(`OIDC Audience: ${audience}`);
  }
  if (hasKioskAuth) {
    console.log("Kiosk authentication token configured");
  }

  return {
    enabled: true,
    issuer,
    audience,
    jwksUri,
    kioskAuthToken,
  };
}
