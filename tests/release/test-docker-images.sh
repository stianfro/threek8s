#!/bin/bash
set -e

# ThreeK8s Docker Image Smoke Tests
# Tests the published Docker images

REGISTRY=${REGISTRY:-ghcr.io}
REPO=${REPO:-stianfro/threek8s}
TAG=${TAG:-latest}
SKIP_PULL=${SKIP_PULL:-false}

echo "=== ThreeK8s Docker Image Smoke Tests ==="
echo "Registry: $REGISTRY"
echo "Repository: $REPO"
echo "Tag: $TAG"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    if [ "$1" = "success" ]; then
        echo -e "${GREEN}✓${NC} $2"
    elif [ "$1" = "error" ]; then
        echo -e "${RED}✗${NC} $2"
    elif [ "$1" = "warning" ]; then
        echo -e "${YELLOW}!${NC} $2"
    else
        echo "$2"
    fi
}

# Cleanup function
cleanup() {
    echo ""
    echo "=== Cleanup ==="
    docker rm -f test-backend test-frontend 2>/dev/null || true
    docker network rm test-network 2>/dev/null || true
    print_status "success" "Cleanup completed"
}

trap cleanup EXIT

# Check Docker
echo "=== Prerequisites ==="
if ! command -v docker &> /dev/null; then
    print_status "error" "Docker not found"
    exit 1
fi
print_status "success" "Docker found"

# Pull images if not skipped
if [ "$SKIP_PULL" != "true" ]; then
    echo ""
    echo "=== Pulling Images ==="

    # Backend image
    echo "Pulling backend image..."
    if docker pull $REGISTRY/$REPO/backend:$TAG; then
        print_status "success" "Backend image pulled"
    else
        print_status "error" "Failed to pull backend image"
        exit 1
    fi

    # Frontend image
    echo "Pulling frontend image..."
    if docker pull $REGISTRY/$REPO/frontend:$TAG; then
        print_status "success" "Frontend image pulled"
    else
        print_status "error" "Failed to pull frontend image"
        exit 1
    fi
else
    print_status "warning" "Skipping image pull (SKIP_PULL=true)"
fi

# Verify images
echo ""
echo "=== Image Verification ==="

# Check backend image
BACKEND_IMAGE="$REGISTRY/$REPO/backend:$TAG"
if docker inspect $BACKEND_IMAGE > /dev/null 2>&1; then
    SIZE=$(docker inspect $BACKEND_IMAGE --format='{{.Size}}' | awk '{print int($1/1024/1024)}')
    print_status "success" "Backend image exists (${SIZE}MB)"

    # Check architecture support
    ARCHS=$(docker manifest inspect $BACKEND_IMAGE 2>/dev/null | jq -r '.manifests[].platform | "\(.os)/\(.architecture)"' | tr '\n' ' ') || true
    if [ -n "$ARCHS" ]; then
        print_status "success" "Backend supports: $ARCHS"
    fi
else
    print_status "error" "Backend image not found"
    exit 1
fi

# Check frontend image
FRONTEND_IMAGE="$REGISTRY/$REPO/frontend:$TAG"
if docker inspect $FRONTEND_IMAGE > /dev/null 2>&1; then
    SIZE=$(docker inspect $FRONTEND_IMAGE --format='{{.Size}}' | awk '{print int($1/1024/1024)}')
    print_status "success" "Frontend image exists (${SIZE}MB)"

    # Check architecture support
    ARCHS=$(docker manifest inspect $FRONTEND_IMAGE 2>/dev/null | jq -r '.manifests[].platform | "\(.os)/\(.architecture)"' | tr '\n' ' ') || true
    if [ -n "$ARCHS" ]; then
        print_status "success" "Frontend supports: $ARCHS"
    fi
else
    print_status "error" "Frontend image not found"
    exit 1
fi

# Test container startup
echo ""
echo "=== Container Tests ==="

# Create test network
docker network create test-network 2>/dev/null || true

# Start backend container
echo "Starting backend container..."
if docker run -d \
    --name test-backend \
    --network test-network \
    -p 8080:8080 \
    -e NODE_ENV=production \
    -e PORT=8080 \
    $BACKEND_IMAGE; then
    print_status "success" "Backend container started"
else
    print_status "error" "Failed to start backend container"
    exit 1
fi

# Start frontend container
echo "Starting frontend container..."
if docker run -d \
    --name test-frontend \
    --network test-network \
    -p 3000:80 \
    -e VITE_API_URL=http://test-backend:8080 \
    $FRONTEND_IMAGE; then
    print_status "success" "Frontend container started"
else
    print_status "error" "Failed to start frontend container"
    exit 1
fi

# Wait for containers to be ready
echo ""
echo "=== Health Checks ==="
sleep 5

# Check backend health
echo "Checking backend health..."
for i in {1..30}; do
    if docker exec test-backend wget -q --spider http://localhost:8080/api/health 2>/dev/null; then
        print_status "success" "Backend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        print_status "error" "Backend health check timeout"
        docker logs test-backend
        exit 1
    fi
    sleep 2
done

# Check frontend health
echo "Checking frontend health..."
for i in {1..30}; do
    if docker exec test-frontend wget -q --spider http://localhost/health 2>/dev/null; then
        print_status "success" "Frontend is healthy"
        break
    fi
    if [ $i -eq 30 ]; then
        print_status "error" "Frontend health check timeout"
        docker logs test-frontend
        exit 1
    fi
    sleep 2
done

# Check container logs
echo ""
echo "=== Container Logs ==="
BACKEND_ERRORS=$(docker logs test-backend 2>&1 | grep -i error | wc -l)
if [ $BACKEND_ERRORS -eq 0 ]; then
    print_status "success" "No errors in backend logs"
else
    print_status "warning" "Found $BACKEND_ERRORS error(s) in backend logs"
fi

FRONTEND_ERRORS=$(docker logs test-frontend 2>&1 | grep -i error | wc -l)
if [ $FRONTEND_ERRORS -eq 0 ]; then
    print_status "success" "No errors in frontend logs"
else
    print_status "warning" "Found $FRONTEND_ERRORS error(s) in frontend logs"
fi

# Test connectivity from host
echo ""
echo "=== Connectivity Tests ==="

# Test backend endpoint
if curl -f -s http://localhost:8080/api/health > /dev/null; then
    print_status "success" "Backend API accessible from host"
else
    print_status "error" "Cannot reach backend API from host"
    exit 1
fi

# Test frontend endpoint
if curl -f -s http://localhost:3000 > /dev/null; then
    print_status "success" "Frontend accessible from host"
else
    print_status "error" "Cannot reach frontend from host"
    exit 1
fi

# Image security scan (optional)
echo ""
echo "=== Security Scan (Optional) ==="
if command -v trivy &> /dev/null; then
    echo "Running Trivy security scan..."

    # Scan backend
    BACKEND_VULNS=$(trivy image --quiet --severity HIGH,CRITICAL --format json $BACKEND_IMAGE | jq '.Results[].Vulnerabilities | length' | awk '{s+=$1} END {print s}')
    if [ "$BACKEND_VULNS" = "0" ] || [ -z "$BACKEND_VULNS" ]; then
        print_status "success" "Backend: No HIGH/CRITICAL vulnerabilities"
    else
        print_status "warning" "Backend: $BACKEND_VULNS HIGH/CRITICAL vulnerabilities found"
    fi

    # Scan frontend
    FRONTEND_VULNS=$(trivy image --quiet --severity HIGH,CRITICAL --format json $FRONTEND_IMAGE | jq '.Results[].Vulnerabilities | length' | awk '{s+=$1} END {print s}')
    if [ "$FRONTEND_VULNS" = "0" ] || [ -z "$FRONTEND_VULNS" ]; then
        print_status "success" "Frontend: No HIGH/CRITICAL vulnerabilities"
    else
        print_status "warning" "Frontend: $FRONTEND_VULNS HIGH/CRITICAL vulnerabilities found"
    fi
else
    print_status "warning" "Trivy not installed, skipping security scan"
fi

# Multi-arch validation
echo ""
echo "=== Multi-Architecture Validation ==="

# Check if images support multi-arch
for IMAGE in "$BACKEND_IMAGE" "$FRONTEND_IMAGE"; do
    NAME=$(echo $IMAGE | cut -d'/' -f3 | cut -d':' -f1)

    # Try to get manifest
    if docker manifest inspect $IMAGE > /dev/null 2>&1; then
        PLATFORMS=$(docker manifest inspect $IMAGE | jq -r '.manifests[].platform | "\(.os)/\(.architecture)"' | sort | uniq | tr '\n' ', ' | sed 's/,$//')
        print_status "success" "$NAME supports: $PLATFORMS"
    else
        print_status "warning" "Cannot verify multi-arch support for $NAME"
    fi
done

# Summary
echo ""
echo "=== Test Summary ==="
print_status "success" "All smoke tests passed!"
echo ""
echo "Image details:"
echo "  Backend: $BACKEND_IMAGE"
echo "  Frontend: $FRONTEND_IMAGE"
echo ""
echo "Container status:"
docker ps --filter name=test-backend --filter name=test-frontend --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

exit 0