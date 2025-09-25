# Multi-stage Dockerfile for React/Three.js frontend
# Optimized for both amd64 and arm64 architectures

# Build stage
FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

# Build arguments for cross-compilation
ARG TARGETPLATFORM
ARG BUILDPLATFORM

WORKDIR /app

# Install build dependencies for native modules if needed
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install ALL dependencies (both production and development) for building
RUN npm ci --no-audit --no-fund && \
    npm cache clean --force

# Copy source code and other necessary files
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public/
COPY src ./src/

# Build the React/Three.js application
RUN npm run build

# Runtime stage with nginx
FROM nginx:alpine AS runtime

# Install dependencies for runtime and healthcheck
RUN apk add --no-cache \
    curl \
    gettext \
    && rm -rf /var/cache/apk/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create environment variable substitution script for runtime config injection
COPY <<EOF /docker-entrypoint.d/30-envsubst-on-templates.sh
#!/bin/sh
set -e

# Replace environment variables in built files
find /usr/share/nginx/html -name "*.js" -exec sed -i "s|VITE_API_URL_PLACEHOLDER|\${VITE_API_URL:-http://localhost:3001/api}|g" {} \;
find /usr/share/nginx/html -name "*.js" -exec sed -i "s|VITE_WS_URL_PLACEHOLDER|\${VITE_WS_URL:-ws://localhost:3001/ws}|g" {} \;

echo "Environment variables injected successfully"
EOF

RUN chmod +x /docker-entrypoint.d/30-envsubst-on-templates.sh

# Create non-root user for security
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001 -G nginx-user && \
    # Set ownership for nginx directories
    chown -R nginx-user:nginx-user /usr/share/nginx/html && \
    chown -R nginx-user:nginx-user /var/cache/nginx && \
    chown -R nginx-user:nginx-user /var/log/nginx && \
    chown -R nginx-user:nginx-user /etc/nginx && \
    # Create pid file with correct ownership
    touch /var/run/nginx.pid && \
    chown nginx-user:nginx-user /var/run/nginx.pid && \
    # Make entrypoint directory accessible
    chown -R nginx-user:nginx-user /docker-entrypoint.d

# Switch to non-root user
USER nginx-user

# Environment variables for runtime configuration
ENV VITE_API_URL=http://localhost:3001/api
ENV VITE_WS_URL=ws://localhost:3001/ws

# Expose port 80 for the frontend
EXPOSE 80

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Labels for better container management
LABEL maintainer="threek8s-team" \
      description="ThreeK8s Frontend - 3D Kubernetes cluster visualization" \
      version="1.0.0" \
      org.opencontainers.image.title="threek8s-frontend" \
      org.opencontainers.image.description="React/Three.js frontend for 3D Kubernetes visualization" \
      org.opencontainers.image.vendor="threek8s"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]