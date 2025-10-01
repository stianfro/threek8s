/**
 * Authentication Service
 *
 * Handles OIDC authentication flow using oidc-client-ts.
 * Supports optional authentication that can be enabled/disabled.
 */

import { UserManager, User, type UserManagerSettings } from "oidc-client-ts";

export interface AuthConfig {
  enabled: boolean;
  authority: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

export class AuthService {
  private userManager: UserManager | null = null;
  private config: AuthConfig;
  private currentUser: User | null = null;
  private authChangeCallbacks: Array<(user: User | null) => void> = [];
  private kioskToken: string | null = null;

  constructor(config: AuthConfig) {
    this.config = config;

    if (config.enabled) {
      const settings: UserManagerSettings = {
        authority: config.authority,
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: config.scope,
        automaticSilentRenew: true,
        silent_redirect_uri: config.redirectUri,
        post_logout_redirect_uri: window.location.origin,
      };

      this.userManager = new UserManager(settings);

      // Setup event handlers
      this.userManager.events.addUserLoaded((user) => {
        this.currentUser = user;
        this.notifyAuthChange(user);
      });

      this.userManager.events.addUserUnloaded(() => {
        this.currentUser = null;
        this.notifyAuthChange(null);
      });

      this.userManager.events.addAccessTokenExpiring(() => {
        console.log("Access token expiring, attempting silent renewal");
      });

      this.userManager.events.addAccessTokenExpired(() => {
        console.log("Access token expired");
        this.currentUser = null;
        this.notifyAuthChange(null);
      });

      this.userManager.events.addSilentRenewError((error) => {
        console.error("Silent renew error:", error);
      });
    }
  }

  /**
   * Initialize authentication service
   * Checks for existing user session
   */
  async initialize(): Promise<User | null> {
    if (!this.config.enabled || !this.userManager) {
      return null;
    }

    try {
      this.currentUser = await this.userManager.getUser();
      return this.currentUser;
    } catch (error) {
      console.error("Failed to get user:", error);
      return null;
    }
  }

  /**
   * Handle OAuth callback
   * Called when redirected back from OIDC provider
   */
  async handleCallback(): Promise<User | null> {
    if (!this.config.enabled || !this.userManager) {
      return null;
    }

    try {
      const user = await this.userManager.signinCallback();
      this.currentUser = user || null;
      this.notifyAuthChange(user || null);
      return user || null;
    } catch (error) {
      console.error("Error handling authentication callback:", error);
      throw error;
    }
  }

  /**
   * Start login flow
   * Redirects to OIDC provider
   */
  async login(): Promise<void> {
    if (!this.config.enabled || !this.userManager) {
      console.warn("Authentication is disabled");
      return;
    }

    try {
      await this.userManager.signinRedirect();
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    if (!this.config.enabled || !this.userManager) {
      return;
    }

    try {
      await this.userManager.signoutRedirect();
      this.currentUser = null;
      this.notifyAuthChange(null);
    } catch (error) {
      console.error("Logout failed:", error);
      throw error;
    }
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    // Return kiosk token if set (takes precedence)
    if (this.kioskToken) {
      return this.kioskToken;
    }
    return this.currentUser?.access_token || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (!this.config.enabled) {
      return true; // When auth is disabled, consider everyone authenticated
    }
    // Check kiosk token first
    if (this.kioskToken) {
      return true;
    }
    return this.currentUser !== null && !this.currentUser.expired;
  }

  /**
   * Check if authentication is enabled
   */
  isAuthEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Register callback for auth state changes
   */
  onAuthChange(callback: (user: User | null) => void): void {
    this.authChangeCallbacks.push(callback);
  }

  /**
   * Notify all callbacks of auth state change
   */
  private notifyAuthChange(user: User | null): void {
    this.authChangeCallbacks.forEach((callback) => callback(user));
  }

  /**
   * Silent token renewal
   */
  async renewToken(): Promise<void> {
    if (!this.config.enabled || !this.userManager) {
      return;
    }

    try {
      const user = await this.userManager.signinSilent();
      this.currentUser = user;
      this.notifyAuthChange(user);
    } catch (error) {
      console.error("Token renewal failed:", error);
      throw error;
    }
  }

  /**
   * Set kiosk authentication token
   * Used for URL-based authentication in kiosk environments
   */
  setKioskToken(token: string): void {
    if (!token || token.trim().length === 0) {
      console.warn("Invalid kiosk token provided");
      return;
    }
    this.kioskToken = token.trim();
    console.log("Kiosk authentication token set");
  }
}
