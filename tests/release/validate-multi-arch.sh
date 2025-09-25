#!/bin/bash
set -e

# Multi-Architecture Manifest Validation Script

REGISTRY=${REGISTRY:-ghcr.io}
REPO=${REPO:-stianfro/threek8s}
TAG=${TAG:-latest}

echo "=== Multi-Architecture Manifest Validation ==="
echo "Registry: $REGISTRY/$REPO"
echo "Tag: $TAG"
echo ""

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

validate_manifest() {
    local IMAGE=$1
    local NAME=$2

    echo ""
    echo "=== Validating $NAME ==="

    # Check if manifest exists
    if ! docker manifest inspect $IMAGE > /dev/null 2>&1; then
        print_status "error" "Cannot fetch manifest for $NAME"
        return 1
    fi

    # Get manifest data
    MANIFEST=$(docker manifest inspect $IMAGE)

    # Check for multi-platform support
    PLATFORMS=$(echo "$MANIFEST" | jq -r '.manifests[].platform | "\(.os)/\(.architecture)"' | sort | uniq)
    PLATFORM_COUNT=$(echo "$PLATFORMS" | wc -l)

    echo "Platforms found:"
    echo "$PLATFORMS" | while read platform; do
        echo "  - $platform"
    done

    # Validate required architectures
    if echo "$PLATFORMS" | grep -q "linux/amd64"; then
        print_status "success" "AMD64 architecture supported"
    else
        print_status "error" "AMD64 architecture missing"
        return 1
    fi

    if echo "$PLATFORMS" | grep -q "linux/arm64"; then
        print_status "success" "ARM64 architecture supported"
    else
        print_status "error" "ARM64 architecture missing"
        return 1
    fi

    # Check manifest list structure
    MANIFEST_TYPE=$(echo "$MANIFEST" | jq -r '.mediaType')
    if [[ "$MANIFEST_TYPE" == *"manifest.list"* ]]; then
        print_status "success" "Valid manifest list structure"
    else
        print_status "warning" "Unexpected manifest type: $MANIFEST_TYPE"
    fi

    # Verify each platform manifest
    echo ""
    echo "Platform details:"
    echo "$MANIFEST" | jq -c '.manifests[]' | while read manifest; do
        ARCH=$(echo "$manifest" | jq -r '.platform.architecture')
        OS=$(echo "$manifest" | jq -r '.platform.os')
        DIGEST=$(echo "$manifest" | jq -r '.digest' | cut -c1-12)
        SIZE=$(echo "$manifest" | jq -r '.size' | numfmt --to=iec-i --suffix=B)

        printf "  %-15s digest: %s... size: %s\n" "$OS/$ARCH" "$DIGEST" "$SIZE"
    done

    return 0
}

# Validate backend image
BACKEND_IMAGE="$REGISTRY/$REPO/backend:$TAG"
if validate_manifest "$BACKEND_IMAGE" "Backend"; then
    BACKEND_STATUS="✓"
else
    BACKEND_STATUS="✗"
fi

# Validate frontend image
FRONTEND_IMAGE="$REGISTRY/$REPO/frontend:$TAG"
if validate_manifest "$FRONTEND_IMAGE" "Frontend"; then
    FRONTEND_STATUS="✓"
else
    FRONTEND_STATUS="✗"
fi

# Summary
echo ""
echo "=== Validation Summary ==="
echo "Backend:  $BACKEND_STATUS $BACKEND_IMAGE"
echo "Frontend: $FRONTEND_STATUS $FRONTEND_IMAGE"

if [ "$BACKEND_STATUS" = "✓" ] && [ "$FRONTEND_STATUS" = "✓" ]; then
    echo ""
    print_status "success" "All images have valid multi-architecture manifests!"
    exit 0
else
    echo ""
    print_status "error" "Some images failed validation"
    exit 1
fi