#!/bin/bash
set -e

# Build script for multi-architecture Docker images
# Supports both amd64 and arm64 architectures

echo "🚀 Building ThreeK8s Frontend Docker Image"

# Configuration
IMAGE_NAME="threek8s-frontend"
TAG="${TAG:-latest}"
REGISTRY="${REGISTRY:-local}"
PLATFORMS="linux/amd64,linux/arm64"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if buildx is available
if ! docker buildx version >/dev/null 2>&1; then
    log_error "Docker buildx is required for multi-architecture builds"
    log_info "Please install Docker Desktop or set up buildx manually"
    exit 1
fi

# Create and use a new builder instance if it doesn't exist
BUILDER_NAME="threek8s-builder"
if ! docker buildx ls | grep -q "$BUILDER_NAME"; then
    log_info "Creating new buildx builder: $BUILDER_NAME"
    docker buildx create --name "$BUILDER_NAME" --driver docker-container --bootstrap
fi

log_info "Using buildx builder: $BUILDER_NAME"
docker buildx use "$BUILDER_NAME"

# Inspect the builder to ensure it supports the required platforms
log_info "Inspecting builder capabilities..."
docker buildx inspect --bootstrap

# Build the image for multiple architectures
log_info "Building image for platforms: $PLATFORMS"
log_info "Image name: $REGISTRY/$IMAGE_NAME:$TAG"

# Build arguments
BUILD_ARGS=""
if [ -n "$BUILD_DATE" ]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg BUILD_DATE=$BUILD_DATE"
else
    BUILD_ARGS="$BUILD_ARGS --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
fi

if [ -n "$GIT_SHA" ]; then
    BUILD_ARGS="$BUILD_ARGS --build-arg GIT_SHA=$GIT_SHA"
else
    BUILD_ARGS="$BUILD_ARGS --build-arg GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
fi

# Determine if we should push or load
if [ "$REGISTRY" = "local" ]; then
    # For local builds, we can only build for current platform
    CURRENT_PLATFORM=$(docker version --format '{{.Server.Os}}/{{.Server.Arch}}')
    log_warn "Building for local use, limiting to current platform: $CURRENT_PLATFORM"

    docker buildx build \
        --platform "$CURRENT_PLATFORM" \
        --target runtime \
        --tag "$IMAGE_NAME:$TAG" \
        --load \
        $BUILD_ARGS \
        .

    log_info "✅ Local image built successfully: $IMAGE_NAME:$TAG"

    # Show image size
    docker images | grep "$IMAGE_NAME" | grep "$TAG"

else
    # For registry builds, build and push multi-arch
    docker buildx build \
        --platform "$PLATFORMS" \
        --target runtime \
        --tag "$REGISTRY/$IMAGE_NAME:$TAG" \
        --push \
        $BUILD_ARGS \
        .

    log_info "✅ Multi-architecture image built and pushed: $REGISTRY/$IMAGE_NAME:$TAG"
fi

# Optional: Test the image
if [ "$REGISTRY" = "local" ] && [ "$TEST_IMAGE" = "true" ]; then
    log_info "🧪 Testing the built image..."

    # Run a quick test
    CONTAINER_ID=$(docker run -d -p 8080:80 --name "test-$IMAGE_NAME" "$IMAGE_NAME:$TAG")

    # Wait for container to start
    sleep 5

    # Test health endpoint
    if curl -f http://localhost:8080/health >/dev/null 2>&1; then
        log_info "✅ Health check passed"
    else
        log_error "❌ Health check failed"
    fi

    # Cleanup test container
    docker stop "$CONTAINER_ID" >/dev/null
    docker rm "$CONTAINER_ID" >/dev/null

    log_info "🧹 Test container cleaned up"
fi

log_info "🎉 Build complete!"

# Show usage instructions
echo ""
echo "📋 Usage Instructions:"
echo "  Local development: docker run -p 80:80 $IMAGE_NAME:$TAG"
echo "  With env vars:     docker run -p 80:80 -e VITE_API_URL=http://api.example.com $IMAGE_NAME:$TAG"
echo "  Health check:      curl http://localhost/health"
echo ""