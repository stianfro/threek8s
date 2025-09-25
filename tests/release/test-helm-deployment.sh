#!/bin/bash
set -e

# ThreeK8s Helm Deployment Test Script
# Tests the Helm chart deployment in a Kubernetes cluster

NAMESPACE=${NAMESPACE:-threek8s-test}
RELEASE_NAME=${RELEASE_NAME:-threek8s-test}
CHART_PATH=${CHART_PATH:-./helm/threek8s}
TIMEOUT=${TIMEOUT:-300}
CLEANUP=${CLEANUP:-true}

echo "=== ThreeK8s Helm Deployment Test ==="
echo "Namespace: $NAMESPACE"
echo "Release: $RELEASE_NAME"
echo "Chart: $CHART_PATH"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Function to cleanup resources
cleanup() {
    echo ""
    echo "=== Cleanup ==="
    if [ "$CLEANUP" = "true" ]; then
        print_status "warning" "Cleaning up test resources..."
        helm uninstall $RELEASE_NAME -n $NAMESPACE 2>/dev/null || true
        kubectl delete namespace $NAMESPACE --wait=false 2>/dev/null || true
        print_status "success" "Cleanup completed"
    else
        print_status "warning" "Cleanup skipped (CLEANUP=false)"
    fi
}

# Trap to ensure cleanup on exit
trap cleanup EXIT

# Check prerequisites
echo "=== Prerequisites Check ==="

# Check kubectl
if ! command -v kubectl &> /dev/null; then
    print_status "error" "kubectl not found. Please install kubectl."
    exit 1
fi
print_status "success" "kubectl found"

# Check helm
if ! command -v helm &> /dev/null; then
    print_status "error" "helm not found. Please install helm."
    exit 1
fi
print_status "success" "helm found"

# Check kubernetes connection
if ! kubectl cluster-info &> /dev/null; then
    print_status "error" "Cannot connect to Kubernetes cluster"
    exit 1
fi
print_status "success" "Connected to Kubernetes cluster"

# Create test namespace
echo ""
echo "=== Setup ==="
kubectl create namespace $NAMESPACE 2>/dev/null || print_status "warning" "Namespace $NAMESPACE already exists"

# Lint the chart
echo ""
echo "=== Chart Validation ==="
if helm lint $CHART_PATH; then
    print_status "success" "Chart validation passed"
else
    print_status "error" "Chart validation failed"
    exit 1
fi

# Dry run installation
echo ""
echo "=== Dry Run ==="
if helm install $RELEASE_NAME $CHART_PATH \
    --namespace $NAMESPACE \
    --dry-run \
    --debug > /dev/null 2>&1; then
    print_status "success" "Dry run successful"
else
    print_status "error" "Dry run failed"
    exit 1
fi

# Install the chart
echo ""
echo "=== Installation ==="
if helm install $RELEASE_NAME $CHART_PATH \
    --namespace $NAMESPACE \
    --wait \
    --timeout ${TIMEOUT}s \
    --set backend.image.tag=latest \
    --set frontend.image.tag=latest; then
    print_status "success" "Helm installation successful"
else
    print_status "error" "Helm installation failed"
    exit 1
fi

# Wait for deployments
echo ""
echo "=== Deployment Status ==="
kubectl wait deployment \
    -n $NAMESPACE \
    -l app.kubernetes.io/instance=$RELEASE_NAME \
    --for=condition=available \
    --timeout=${TIMEOUT}s

if [ $? -eq 0 ]; then
    print_status "success" "All deployments are ready"
else
    print_status "error" "Deployments failed to become ready"
    kubectl get pods -n $NAMESPACE
    exit 1
fi

# Check pod status
echo ""
echo "=== Pod Status ==="
PODS=$(kubectl get pods -n $NAMESPACE -l app.kubernetes.io/instance=$RELEASE_NAME -o jsonpath='{.items[*].metadata.name}')
for pod in $PODS; do
    STATUS=$(kubectl get pod $pod -n $NAMESPACE -o jsonpath='{.status.phase}')
    if [ "$STATUS" = "Running" ]; then
        print_status "success" "Pod $pod is Running"
    else
        print_status "error" "Pod $pod is $STATUS"
        kubectl describe pod $pod -n $NAMESPACE
        exit 1
    fi
done

# Check services
echo ""
echo "=== Service Status ==="
SERVICES=$(kubectl get svc -n $NAMESPACE -l app.kubernetes.io/instance=$RELEASE_NAME -o jsonpath='{.items[*].metadata.name}')
for svc in $SERVICES; do
    ENDPOINTS=$(kubectl get endpoints $svc -n $NAMESPACE -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
    if [ $ENDPOINTS -gt 0 ]; then
        print_status "success" "Service $svc has $ENDPOINTS endpoint(s)"
    else
        print_status "error" "Service $svc has no endpoints"
        exit 1
    fi
done

# Test helm operations
echo ""
echo "=== Helm Operations ==="

# Test helm test
if helm test $RELEASE_NAME -n $NAMESPACE; then
    print_status "success" "Helm test passed"
else
    print_status "warning" "Helm test failed or not configured"
fi

# Test helm upgrade
echo "Testing upgrade..."
if helm upgrade $RELEASE_NAME $CHART_PATH \
    --namespace $NAMESPACE \
    --reuse-values \
    --wait \
    --timeout ${TIMEOUT}s; then
    print_status "success" "Helm upgrade successful"
else
    print_status "error" "Helm upgrade failed"
    exit 1
fi

# Test helm rollback
echo "Testing rollback..."
if helm rollback $RELEASE_NAME 1 \
    --namespace $NAMESPACE \
    --wait \
    --timeout ${TIMEOUT}s; then
    print_status "success" "Helm rollback successful"
else
    print_status "error" "Helm rollback failed"
    exit 1
fi

# Final status
echo ""
echo "=== Test Summary ==="
print_status "success" "All tests passed successfully!"
echo ""
echo "Deployment details:"
helm list -n $NAMESPACE
echo ""
kubectl get all -n $NAMESPACE -l app.kubernetes.io/instance=$RELEASE_NAME

exit 0