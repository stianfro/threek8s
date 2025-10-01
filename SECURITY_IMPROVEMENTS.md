# Security Improvements Guide

This document provides detailed implementation instructions for addressing security concerns identified in the OIDC authentication implementation.

## Table of Contents
- [Critical Issues](#critical-issues)
- [Medium Priority Issues](#medium-priority-issues)
- [Low Priority Issues](#low-priority-issues)
- [Testing Requirements](#testing-requirements)

---

## Critical Issues

### 1. Token Exposure in WebSocket URLs (HIGH)

**Problem**: Tokens in WebSocket URLs are logged in server logs, browser history, and proxy logs.

**Current Implementation** (`frontend/src/services/WebSocketService.ts:54-62`):
```typescript
let wsUrl = this.url;
if (this.getAccessToken) {
  const token = this.getAccessToken();
  if (token) {
    const separator = this.url.includes("?") ? "&" : "?";
    wsUrl = `${this.url}${separator}token=${encodeURIComponent(token)}`;
  }
}
```

**Recommended Fix**: Use WebSocket subprotocol or custom headers

**Option A: Use WebSocket Protocols (Recommended)**
```typescript
// frontend/src/services/WebSocketService.ts
public connect(): void {
  // ... existing code ...

  try {
    const token = this.getAccessToken?.();

    if (token) {
      // Pass token as subprotocol (WebSocket doesn't support custom headers directly)
      // Format: "access_token.{base64url-encoded-token}"
      const encodedToken = btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      this.ws = new WebSocket(this.url, [`access_token`, encodedToken]);
    } else {
      this.ws = new WebSocket(this.url);
    }

    this.setupEventHandlers();
  } catch (error) {
    console.error("Failed to create WebSocket:", error);
    this.handleError(error as Error);
    this.scheduleReconnect();
  }
}
```

**Backend Changes** (`backend/src/services/WebSocketManager.ts:106-139`):
```typescript
private async authenticateConnection(
  request: IncomingMessage,
): Promise<{ authenticated: boolean; error?: string }> {
  if (!this.tokenValidator || !this.tokenValidator.isAuthEnabled()) {
    return { authenticated: true };
  }

  try {
    let token: string | null = null;

    // Try to get token from WebSocket subprotocol
    const protocols = request.headers['sec-websocket-protocol'];
    if (protocols) {
      const protocolList = Array.isArray(protocols)
        ? protocols
        : protocols.split(',').map(p => p.trim());

      const tokenIndex = protocolList.indexOf('access_token');
      if (tokenIndex !== -1 && protocolList[tokenIndex + 1]) {
        // Decode base64url token
        const encodedToken = protocolList[tokenIndex + 1];
        token = atob(encodedToken.replace(/-/g, '+').replace(/_/g, '/'));
      }
    }

    // Fallback: Try Authorization header (for testing/backward compatibility)
    if (!token) {
      const authHeader = request.headers["authorization"];
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return { authenticated: false, error: "No token provided" };
    }

    await this.tokenValidator.validateToken(token);
    return { authenticated: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { authenticated: false, error: errorMessage };
  }
}
```

**WebSocket Server Setup** (backend/src/services/WebSocketManager.ts:37-45):
```typescript
this.wss = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: 1 * 1024 * 1024, // Reduced to 1MB (see issue #7)
  handleProtocols: (protocols, request) => {
    // Accept the access_token protocol if provided
    if (protocols.has('access_token')) {
      return 'access_token';
    }
    return false;
  }
});
```

---

### 2. Missing Security Headers (MEDIUM-HIGH)

**Problem**: No security headers configured (CSP, X-Frame-Options, HSTS, etc.)

**Fix**: Install and configure helmet.js

```bash
cd backend
npm install helmet
```

**Implementation** (`backend/src/app.ts`):
```typescript
import helmet from "helmet";

export function createApp(
  kubernetesService: KubernetesService,
  stateManager: StateManager,
  oidcConfig: OidcConfig,
): Express {
  const app = express();

  // Security headers - Add BEFORE other middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Three.js may need inline styles
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // May need to adjust based on Three.js requirements
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  // Middleware
  app.use(express.json({ limit: '100kb' })); // Add size limit
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // ... rest of the code
}
```

**Note**: You may need to adjust CSP directives based on Three.js and frontend requirements. Test thoroughly.

---

### 3. No Authentication Tests (MEDIUM)

**Problem**: No security tests for authentication/authorization logic

**Fix**: Create comprehensive auth test suite

**Install test dependencies** (if not already present):
```bash
cd backend
npm install --save-dev supertest nock
```

**Create test file** (`backend/tests/unit/auth-middleware.test.ts`):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import nock from 'nock';
import { createAuthMiddleware, authErrorHandler } from '../../src/middleware/auth';
import { OidcConfig } from '../../src/config/oidc';

describe('Authentication Middleware', () => {
  let app: Express;
  const mockJwksUri = 'https://login.example.com/keys';
  const mockIssuer = 'https://login.example.com';
  const mockAudience = 'test-client-id';

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('when auth is disabled', () => {
    it('should allow requests without tokens', async () => {
      const config: OidcConfig = {
        enabled: false,
        issuer: '',
        audience: '',
        jwksUri: ''
      };

      const authMiddleware = createAuthMiddleware(config);
      app.get('/test', authMiddleware, (req, res) => {
        res.status(200).json({ success: true });
      });

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('when auth is enabled', () => {
    let config: OidcConfig;

    beforeEach(() => {
      config = {
        enabled: true,
        issuer: mockIssuer,
        audience: mockAudience,
        jwksUri: mockJwksUri
      };
    });

    it('should reject requests without Authorization header', async () => {
      const authMiddleware = createAuthMiddleware(config);
      app.get('/test', authMiddleware, (req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(authErrorHandler);

      await request(app)
        .get('/test')
        .expect(401);
    });

    it('should reject requests with malformed tokens', async () => {
      const authMiddleware = createAuthMiddleware(config);
      app.get('/test', authMiddleware, (req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(authErrorHandler);

      await request(app)
        .get('/test')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject expired tokens', async () => {
      // Test with expired token
      // You'll need to generate a proper expired JWT for this test
    });

    it('should reject tokens with invalid audience', async () => {
      // Test with token that has wrong audience
      // You'll need to generate a JWT with different audience
    });

    it('should reject tokens with invalid issuer', async () => {
      // Test with token from wrong issuer
    });

    it('should reject tokens with invalid signature', async () => {
      // Test with token that has been tampered with
    });
  });
});
```

**Create TokenValidator tests** (`backend/tests/unit/token-validator.test.ts`):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TokenValidator } from '../../src/services/TokenValidator';
import { OidcConfig } from '../../src/config/oidc';

describe('TokenValidator', () => {
  describe('when auth is disabled', () => {
    it('should return anonymous user', async () => {
      const config: OidcConfig = {
        enabled: false,
        issuer: '',
        audience: '',
        jwksUri: ''
      };

      const validator = new TokenValidator(config);
      const result = await validator.validateToken('any-token');

      expect(result.sub).toBe('anonymous');
    });
  });

  describe('when auth is enabled', () => {
    it('should reject tokens without kid header', async () => {
      const config: OidcConfig = {
        enabled: true,
        issuer: 'https://example.com',
        audience: 'test-client',
        jwksUri: 'https://example.com/.well-known/jwks.json'
      };

      const validator = new TokenValidator(config);

      await expect(validator.validateToken('invalid')).rejects.toThrow();
    });

    // Add more tests for valid tokens, Entra ID appid claim, etc.
  });
});
```

**Add WebSocket auth tests** (`backend/tests/unit/websocket-auth.test.ts`):
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocketManager } from '../../src/services/WebSocketManager';
import { TokenValidator } from '../../src/services/TokenValidator';
// Add tests for WebSocket authentication scenarios
```

---

## Medium Priority Issues

### 4. CORS Configuration Validation (MEDIUM)

**Problem**: CORS origins are not validated; could accidentally allow wildcards

**Fix**: Add validation and sanitization

**Implementation** (`backend/src/app.ts`):
```typescript
// Add helper function
function validateCorsOrigins(origins: string[]): string[] {
  const validated = origins.map(origin => origin.trim()).filter(origin => {
    // Reject empty strings
    if (!origin) return false;

    // Warn about wildcards in production
    if (origin === '*' && process.env.NODE_ENV === 'production') {
      console.error('SECURITY WARNING: CORS wildcard (*) is not allowed in production');
      return false;
    }

    // Validate origin format
    try {
      new URL(origin);
      return true;
    } catch {
      console.warn(`Invalid CORS origin format: ${origin}`);
      return false;
    }
  });

  if (validated.length === 0) {
    console.warn('No valid CORS origins configured, using default');
    return ['http://localhost:5173'];
  }

  return validated;
}

// Update CORS configuration
const corsOriginsRaw = process.env.CORS_ORIGINS?.split(",") || ["http://localhost:5173"];
const corsOrigins = validateCorsOrigins(corsOriginsRaw);

console.log('Configured CORS origins:', corsOrigins);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
  }),
);
```

---

### 5. Missing Rate Limiting (MEDIUM)

**Problem**: No rate limiting on API endpoints

**Fix**: Install and configure express-rate-limit

```bash
cd backend
npm install express-rate-limit
```

**Implementation** (`backend/src/app.ts`):
```typescript
import rateLimit from 'express-rate-limit';

export function createApp(...) {
  const app = express();

  // Rate limiting - Add AFTER helmet, BEFORE routes
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Stricter limit for auth endpoints
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: true
  });

  // Apply to all API routes
  app.use('/api/', limiter);

  // ... rest of the code
}
```

---

### 6. Token Storage in Browser Storage (MEDIUM)

**Problem**: Tokens in sessionStorage/localStorage are vulnerable to XSS

**Fix**: Document the risk and mitigation strategies

**Add to README.md** (in Authentication section):
```markdown
#### Security Considerations

**Token Storage**: This implementation uses `oidc-client-ts`, which stores tokens in browser sessionStorage. While convenient, this approach has security implications:

- **XSS Risk**: If an attacker can execute JavaScript in your application, they can steal tokens
- **Mitigation Strategies**:
  - Implement strict Content Security Policy (CSP) headers
  - Regularly update dependencies to patch XSS vulnerabilities
  - Use short token expiration times (recommended: 1 hour or less)
  - Enable automatic silent token renewal
  - Consider additional security layers (network isolation, IP allowlisting)

**Alternative**: For higher security requirements, consider:
- Using httpOnly cookies with SameSite=Strict
- Implementing a backend-for-frontend (BFF) pattern
- Using refresh token rotation

**Current Configuration**:
- Token expiration: Configured by your OIDC provider
- Silent renewal: Enabled by default
- Token refresh: Automatic before expiration
```

---

### 7. Large WebSocket Payload Limit (LOW-MEDIUM)

**Problem**: 10MB max payload could enable DoS attacks

**Fix**: Reduce to reasonable size based on actual data needs

**Implementation** (`backend/src/services/WebSocketManager.ts:40`):
```typescript
this.wss = new WebSocketServer({
  server,
  path: "/ws",
  maxPayload: 1 * 1024 * 1024, // Reduced to 1MB (from 10MB)
});
```

**Add validation**: If you need larger payloads, add validation:
```typescript
ws.on('message', (data: Buffer) => {
  // Validate message size
  if (data.length > 1024 * 1024) { // 1MB
    console.warn(`Client ${clientId} sent oversized message: ${data.length} bytes`);
    this.sendToClient(
      clientId,
      WebSocketMessageFactory.createErrorMessage(
        'MESSAGE_TOO_LARGE',
        'Message size exceeds limit'
      )
    );
    return;
  }

  this.handleClientMessage(clientId, data);
});
```

---

### 8. OIDC State Parameter Validation (MEDIUM)

**Problem**: Need to verify CSRF protection via state parameter

**Fix**: Verify oidc-client-ts configuration

The `oidc-client-ts` library handles the `state` parameter automatically for CSRF protection. However, you should verify it's enabled:

**Check configuration** (`frontend/src/services/AuthService.ts:28-37`):
```typescript
const settings: UserManagerSettings = {
  authority: config.authority,
  client_id: config.clientId,
  redirect_uri: config.redirectUri,
  response_type: "code",
  scope: config.scope,
  automaticSilentRenew: true,
  silent_redirect_uri: config.redirectUri,
  post_logout_redirect_uri: window.location.origin,

  // Explicitly enable state parameter (it's on by default, but be explicit)
  // oidc-client-ts automatically generates and validates state
  loadUserInfo: true,

  // Add these for additional security
  monitorSession: true,
  checkSessionInterval: 2000,

  // Validate token signature
  validateSubOnSilentRenew: true,
};
```

**Note**: The library handles state generation and validation automatically. No additional code needed, but document this behavior.

---

## Low Priority Issues

### 9. Information Disclosure in Dev Mode (LOW)

**Problem**: Development errors expose too much detail

**Fix**: Reduce verbosity

**Update** (`backend/src/middleware/auth.ts:80-88`):
```typescript
if (!audienceValid) {
  const errorDetails = process.env.NODE_ENV === "development"
    ? `Audience validation failed` // Reduced detail
    : undefined;

  console.error(`[AUTH] Audience validation failed for token. Expected: ${config.audience}`);

  return res.status(401).json({
    error: "UNAUTHORIZED",
    message: "Invalid token audience",
    details: errorDetails
  });
}
```

---

### 10. Anonymous Bypass Logging (LOW)

**Problem**: Returning `{sub: "anonymous"}` is misleading in logs

**Fix**: Return more explicit structure

**Update** (`backend/src/services/TokenValidator.ts:36-41`):
```typescript
async validateToken(token: string): Promise<any> {
  if (!this.config.enabled) {
    console.debug("Token validation skipped - authentication is disabled");
    return {
      sub: "system",
      auth_disabled: true,
      timestamp: new Date().toISOString()
    };
  }
  // ... rest of the code
}
```

---

### 11. Namespace Filter Input Validation (LOW)

**Problem**: No validation of namespace filter input

**Fix**: Add input validation

**Update** (`backend/src/services/WebSocketManager.ts:141-152`):
```typescript
private parseNamespaceFilter(url?: string): string[] | undefined {
  if (!url) return undefined;

  const params = new URLSearchParams(url.split("?")[1] || "");
  const namespaces = params.get("namespaces");

  if (namespaces) {
    // Kubernetes namespace validation
    const k8sNamespaceRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

    const validated = namespaces
      .split(",")
      .map((ns) => ns.trim())
      .filter((ns) => {
        // Must be 1-63 characters
        if (ns.length === 0 || ns.length > 63) {
          console.warn(`Invalid namespace length: ${ns}`);
          return false;
        }

        // Must match Kubernetes naming rules
        if (!k8sNamespaceRegex.test(ns)) {
          console.warn(`Invalid namespace format: ${ns}`);
          return false;
        }

        return true;
      });

    return validated.length > 0 ? validated : undefined;
  }

  return undefined;
}
```

---

### 12. Secrets in Helm Values (LOW)

**Problem**: OIDC config exposed as plain environment variables

**Fix**: Use Kubernetes Secrets

**Create secret template** (`helm/threek8s/templates/oidc-secret.yaml`):
```yaml
{{- if .Values.auth.enabled }}
apiVersion: v1
kind: Secret
metadata:
  name: {{ include "threek8s.fullname" . }}-oidc
  labels:
    {{- include "threek8s.labels" . | nindent 4 }}
type: Opaque
stringData:
  oidc-issuer: {{ .Values.auth.oidc.issuer | quote }}
  oidc-audience: {{ .Values.auth.oidc.audience | quote }}
  oidc-jwks-uri: {{ .Values.auth.oidc.jwksUri | quote }}
  oidc-client-id: {{ .Values.auth.oidc.clientId | quote }}
  oidc-redirect-uri: {{ .Values.auth.oidc.redirectUri | quote }}
  oidc-scope: {{ .Values.auth.oidc.scope | quote }}
{{- end }}
```

**Update backend deployment** (`helm/threek8s/templates/backend-deployment.yaml`):
```yaml
{{- if .Values.auth.enabled }}
- name: AUTH_ENABLED
  value: "true"
- name: OIDC_ISSUER
  valueFrom:
    secretKeyRef:
      name: {{ include "threek8s.fullname" . }}-oidc
      key: oidc-issuer
- name: OIDC_AUDIENCE
  valueFrom:
    secretKeyRef:
      name: {{ include "threek8s.fullname" . }}-oidc
      key: oidc-audience
- name: OIDC_JWKS_URI
  valueFrom:
    secretKeyRef:
      name: {{ include "threek8s.fullname" . }}-oidc
      key: oidc-jwks-uri
{{- else }}
- name: AUTH_ENABLED
  value: "false"
{{- end }}
```

**Update frontend deployment** similarly for frontend OIDC config.

---

## Testing Requirements

### Minimum Test Coverage

1. **Authentication Middleware**:
   - Requests without tokens (auth enabled vs disabled)
   - Malformed tokens
   - Expired tokens
   - Invalid audience/issuer
   - Invalid signatures
   - Valid tokens with proper claims

2. **Token Validator**:
   - Auth disabled scenarios
   - Invalid token formats
   - Missing kid header
   - Audience validation (aud + appid claims)
   - JWKS key retrieval

3. **WebSocket Authentication**:
   - Unauthenticated connections
   - Token in subprotocol
   - Token expiration during connection
   - Token refresh scenarios

4. **Security Headers**:
   - Verify all helmet headers are present
   - CSP violations

5. **Rate Limiting**:
   - Verify rate limits trigger
   - Verify successful requests don't count against limit

### Running Security Tests

```bash
# Backend tests
cd backend
npm test -- --grep "auth|security"

# Run with coverage
npm test -- --coverage

# Frontend tests (if applicable)
cd frontend
npm test
```

---

## Implementation Priority

### Phase 1 (Critical - Implement First)
1. WebSocket token in headers/subprotocol
2. Security headers (helmet.js)
3. Basic authentication tests

### Phase 2 (Medium - Implement Next)
4. Rate limiting
5. CORS validation
6. WebSocket payload limit reduction
7. Input validation

### Phase 3 (Low - Nice to Have)
8. Kubernetes Secrets for OIDC config
9. Enhanced error messages
10. Documentation updates

---

## Verification Checklist

After implementing fixes:

- [ ] WebSocket tokens no longer appear in URLs
- [ ] Security headers present in all responses
- [ ] Authentication tests pass with >80% coverage
- [ ] Rate limiting triggers after threshold
- [ ] Invalid CORS origins rejected
- [ ] Invalid namespace names rejected
- [ ] OIDC config stored in Kubernetes Secrets
- [ ] No security warnings in `npm audit`
- [ ] Documentation updated with security considerations
- [ ] All existing tests still pass

---

## Questions or Issues?

If you encounter any issues implementing these fixes or need clarification:

1. Check the existing implementation for similar patterns
2. Refer to library documentation:
   - [helmet.js](https://helmetjs.github.io/)
   - [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)
   - [oidc-client-ts](https://github.com/authts/oidc-client-ts)
3. Test thoroughly in development before deploying to production
