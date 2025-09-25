# Multi-stage Dockerfile for React/Three.js frontend
# Optimized for amd64 architecture

# Build stage
FROM node:20-alpine AS builder

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

# Copy all source files (excluding those in .dockerignore)
COPY . .

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

# Prepare for running as non-root (OpenShift compatible)
# Make nginx directories writable by root group
RUN chgrp -R 0 /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx /var/run /docker-entrypoint.d && \
    chmod -R g+rwX /usr/share/nginx/html /var/cache/nginx /var/log/nginx /etc/nginx /var/run /docker-entrypoint.d && \
    # Create nginx.pid file
    touch /var/run/nginx.pid && \
    chgrp 0 /var/run/nginx.pid && \
    chmod g+rw /var/run/nginx.pid

# Run as UID 1001 (but OpenShift will override this)
USER 1001

# Environment variables for runtime configuration
ENV VITE_API_URL=http://localhost:3001/api
ENV VITE_WS_URL=ws://localhost:3001/ws

# Expose port 8080 for the frontend (OpenShift compatible)
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Labels for better container management
LABEL maintainer="threek8s-team" \
      description="ThreeK8s Frontend - 3D Kubernetes cluster visualization" \
      version="1.0.0" \
      org.opencontainers.image.title="threek8s-frontend" \
      org.opencontainers.image.description="React/Three.js frontend for 3D Kubernetes visualization" \
      org.opencontainers.image.vendor="threek8s"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]