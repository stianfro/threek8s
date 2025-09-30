#!/bin/bash

# Cleanup KWOK test cluster for threek8s

set -e

CLUSTER_NAME="threek8s-test"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ThreeK8s KWOK Cluster Cleanup ===${NC}"

# Check if kwokctl is installed
if ! command -v kwokctl &> /dev/null; then
    echo -e "${RED}ERROR: kwokctl is not installed${NC}"
    exit 1
fi

# Check if cluster exists
if ! kwokctl get clusters | grep -q "^${CLUSTER_NAME}$"; then
    echo -e "${YELLOW}Cluster '${CLUSTER_NAME}' does not exist. Nothing to clean up.${NC}"
    exit 0
fi

# Confirm deletion
echo -e "${YELLOW}This will delete the '${CLUSTER_NAME}' cluster and all its resources.${NC}"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Delete cluster
echo -e "${GREEN}Deleting KWOK cluster '${CLUSTER_NAME}'...${NC}"
kwokctl delete cluster --name="${CLUSTER_NAME}"

echo ""
echo -e "${GREEN}Cleanup complete!${NC}"
echo ""
echo "The cluster '${CLUSTER_NAME}' has been removed."
echo "Your kubectl context has been switched back to the previous context."
echo ""