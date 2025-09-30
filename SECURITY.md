# Security Policy

## Reporting a Vulnerability

We take the security of threek8s seriously. If you discover a security vulnerability, please follow these steps:

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing the maintainers directly or by using GitHub's private vulnerability reporting feature:

1. Go to the [Security tab](../../security/advisories/new) of this repository
2. Click "Report a vulnerability"
3. Provide detailed information about the vulnerability

### What to Include

When reporting a vulnerability, please include:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact of the vulnerability
- Any suggested fixes or mitigations (if you have them)
- Your contact information for follow-up questions

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
- **Assessment**: We will assess the vulnerability and determine its severity and impact
- **Resolution**: We will work on a fix and keep you informed of our progress
- **Disclosure**: Once a fix is available, we will coordinate disclosure timing with you

## Security Measures

This project implements several security measures:

### Static Application Security Testing (SAST)
- **ESLint Security Plugins**: Code is automatically scanned for security issues
  - `eslint-plugin-security` - detects common security anti-patterns
  - `eslint-plugin-no-secrets` - prevents hardcoded secrets from being committed
- Run locally with: `npm run lint:security`

### Dependency Security
- **npm audit**: Dependencies are regularly scanned for known vulnerabilities
- Run locally with: `npm run audit`
- CI/CD pipeline fails on HIGH or CRITICAL vulnerabilities
- Automated dependency updates are reviewed regularly

### Container Security
- **Trivy scanning**: Docker images are scanned for OS and dependency vulnerabilities
- Scans run automatically in CI/CD pipelines
- Results are uploaded to GitHub Security tab for review
- Only images passing security checks are published

### TypeScript Strict Mode
- Enhanced TypeScript compiler options for type safety
- `noUncheckedIndexedAccess` - prevents unsafe array/object access
- `noImplicitReturns` - ensures all code paths return values
- `noImplicitOverride` - prevents accidental method override issues

### Kubernetes Security Considerations

Since threek8s runs inside Kubernetes clusters with access to the Kubernetes API:

- **Least Privilege**: Deploy with minimal required RBAC permissions
- **Read-Only Access**: Default configuration uses read-only service accounts
- **Network Policies**: Consider implementing network policies to restrict traffic
- **Pod Security Standards**: Run with restricted pod security standards when possible
- **Non-Root User**: Containers run as non-root user (UID 1001)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices for Users

When deploying threek8s:

1. **Limit API Access**: Use RBAC to grant only the minimum required permissions
2. **Use Network Policies**: Restrict network access to/from the application
3. **Keep Updated**: Regularly update to the latest version to receive security fixes
4. **Monitor Logs**: Enable audit logging for security monitoring
5. **Use Secrets Management**: Store sensitive configuration in Kubernetes Secrets
6. **Enable TLS**: Use TLS/HTTPS for all external communications

## Security Updates

Security updates are prioritized and released as quickly as possible. Users are notified through:

- GitHub Security Advisories
- Release notes
- GitHub Releases page

## Acknowledgments

We appreciate the security research community's efforts in responsibly disclosing vulnerabilities and helping keep threek8s secure.