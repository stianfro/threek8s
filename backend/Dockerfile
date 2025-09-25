# Multi-stage Dockerfile for ThreeK8s Backend
# Optimized for amd64 architecture

# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native modules if needed
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy all source files (excluding those in .dockerignore)
COPY . .

# Build the TypeScript application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Install system dependencies for runtime and health checks
RUN apk add --no-cache \
    dumb-init \
    curl \
    tini

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create directory for logs
RUN mkdir -p /app/logs

# Prepare for running as non-root (OpenShift compatible)
# Make app directories writable by root group
RUN chgrp -R 0 /app && \
    chmod -R g+rwX /app

# Run as UID 1001 (but OpenShift will override this)
USER 1001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port 8080 for the backend service
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Use tini for proper signal handling and zombie reaping
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]