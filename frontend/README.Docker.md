# ThreeK8s Frontend Docker Setup

This directory contains a production-ready, multi-stage Dockerfile for the ThreeK8s React/Three.js frontend application.

## Features

✅ **Multi-stage Build**: Optimized build process with separate build and runtime stages
✅ **Multi-architecture Support**: Builds for both AMD64 and ARM64 architectures
✅ **Runtime Environment Variables**: Support for configuring API endpoints at runtime
✅ **Security Hardened**: Runs as non-root user with security headers
✅ **Production Optimized**: Nginx with gzip compression, caching, and performance tuning
✅ **Health Checks**: Built-in health and readiness endpoints
✅ **SPA Routing**: Properly configured for Single Page Application routing

## Quick Start

### Build Local Image

```bash
# Build for current architecture
docker build -t threek8s-frontend .

# Run with default configuration
docker run -p 80:80 threek8s-frontend
```

### Build Multi-Architecture

```bash
# Use the provided build script
./build-multi-arch.sh

# Or manually with buildx
docker buildx build --platform linux/amd64,linux/arm64 -t threek8s-frontend .
```

### Run with Custom Configuration

```bash
docker run -p 80:80 \
  -e VITE_API_URL=http://your-api.example.com/api \
  -e VITE_WS_URL=ws://your-api.example.com/ws \
  threek8s-frontend
```

## Environment Variables

The following environment variables can be set at runtime:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001/api` | Backend API endpoint |
| `VITE_WS_URL` | `ws://localhost:3001/ws` | WebSocket endpoint |

## Docker Compose

Use the provided `docker-compose.yml` for local development:

```bash
# Start the frontend service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Health Checks

The container exposes several health check endpoints:

- `/health` - Basic health check (returns "healthy")
- `/ready` - Readiness probe (checks if index.html exists)

```bash
# Test health endpoint
curl http://localhost/health

# Test readiness endpoint
curl http://localhost/ready
```

## Build Stages

### Stage 1: Builder (`node:20-alpine`)
- Installs build dependencies
- Runs `npm ci` for dependencies
- Executes `npm run build` to create production assets

### Stage 2: Runtime (`nginx:alpine`)
- Copies built assets from builder stage
- Configures nginx for SPA routing
- Sets up non-root user for security
- Enables gzip compression and caching

## Nginx Configuration

The custom nginx configuration includes:

- **SPA Support**: All routes redirect to `index.html`
- **Asset Caching**: Long-term caching for static assets
- **Security Headers**: CSP, XSS protection, and other security headers
- **Gzip Compression**: Optimized compression for better performance
- **Health Endpoints**: `/health` and `/ready` for orchestration

## Security Features

- Runs as non-root user (`nginx-user`)
- Read-only filesystem with tmpfs mounts for writable directories
- Security headers (CSP, X-Frame-Options, etc.)
- Hidden nginx version
- Blocked access to sensitive files

## Multi-Architecture Support

The Dockerfile supports building for multiple architectures:

```bash
# Build for specific platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag threek8s-frontend:latest \
  .
```

## Optimization Tips

1. **Layer Caching**: Package files are copied before source code for better caching
2. **Multi-stage**: Only production assets are included in final image
3. **Compression**: Nginx gzip compression reduces payload size
4. **Asset Caching**: Static assets cached for 1 year
5. **No Caching**: HTML files not cached for SPA updates

## Troubleshooting

### Build Issues

```bash
# Clear Docker build cache
docker builder prune -a

# Build with no cache
docker build --no-cache -t threek8s-frontend .
```

### Runtime Issues

```bash
# Check container logs
docker logs <container-id>

# Execute shell in container
docker exec -it <container-id> sh

# Test nginx configuration
docker exec -it <container-id> nginx -t
```

### Permission Issues

The container runs as user `nginx-user` (UID 1001). Ensure any mounted volumes have appropriate permissions.

## Production Deployment

For production deployment, consider:

1. **Environment Variables**: Set appropriate API endpoints
2. **TLS Termination**: Use a reverse proxy with TLS
3. **Resource Limits**: Set appropriate CPU/memory limits
4. **Health Checks**: Configure health check intervals
5. **Logging**: Set up log aggregation
6. **Monitoring**: Monitor container health and performance

## Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| Base Image | `node:20-alpine` | `nginx:alpine` |
| Hot Reload | ✅ | ❌ |
| Source Maps | ✅ | ❌ |
| Minification | ❌ | ✅ |
| Gzip | ❌ | ✅ |
| Security Headers | ❌ | ✅ |
| Health Checks | ❌ | ✅ |

This Docker setup provides a production-ready foundation for deploying the ThreeK8s frontend in any container orchestration platform.