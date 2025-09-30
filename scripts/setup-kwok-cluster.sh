#!/bin/bash

# Setup KWOK cluster for threek8s testing
# Creates a 40-node cluster across 3 zones with test pods

set -e

CLUSTER_NAME="threek8s-test"
TOTAL_NODES=40
ZONES=("us-east-1a" "us-east-1b" "us-east-1c")

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== ThreeK8s KWOK Cluster Setup ===${NC}"

# Check if kwokctl is installed
if ! command -v kwokctl &> /dev/null; then
    echo -e "${RED}ERROR: kwokctl is not installed${NC}"
    echo ""
    echo "Please install KWOK first:"
    echo ""
    echo "# macOS"
    echo "brew install kwok"
    echo ""
    echo "# Linux"
    echo "curl -LO https://github.com/kubernetes-sigs/kwok/releases/latest/download/kwok-linux-amd64"
    echo "chmod +x kwok-linux-amd64"
    echo "sudo mv kwok-linux-amd64 /usr/local/bin/kwokctl"
    echo ""
    echo "For more installation options, visit: https://kwok.sigs.k8s.io/docs/user/installation/"
    exit 1
fi

# Check if cluster already exists
if kwokctl get clusters | grep -q "^${CLUSTER_NAME}$"; then
    echo -e "${YELLOW}Cluster '${CLUSTER_NAME}' already exists. Deleting it first...${NC}"
    kwokctl delete cluster --name="${CLUSTER_NAME}"
    sleep 2
fi

# Create KWOK cluster
echo -e "${GREEN}Creating KWOK cluster '${CLUSTER_NAME}'...${NC}"
kwokctl create cluster --name="${CLUSTER_NAME}"

# Wait for cluster to be ready
echo "Waiting for cluster to be ready..."
sleep 5

# Set kubectl context to use the KWOK cluster
kubectl config use-context "kwok-${CLUSTER_NAME}"

echo -e "${GREEN}Creating 40 nodes across 3 zones...${NC}"

# Calculate nodes per zone
NODES_PER_ZONE=$((TOTAL_NODES / 3))
EXTRA_NODES=$((TOTAL_NODES % 3))

node_counter=1

for zone_idx in "${!ZONES[@]}"; do
    zone="${ZONES[$zone_idx]}"

    # Distribute extra nodes across first zones
    if [ $zone_idx -lt $EXTRA_NODES ]; then
        nodes_in_zone=$((NODES_PER_ZONE + 1))
    else
        nodes_in_zone=$NODES_PER_ZONE
    fi

    echo "Creating ${nodes_in_zone} nodes in zone ${zone}..."

    for ((i=1; i<=nodes_in_zone; i++)); do
        node_name=$(printf "node-%s-%03d" "$zone" "$i")

        # Vary CPU and memory slightly for realistic testing
        cpu=$((2 + (node_counter % 3)))  # 2, 3, or 4 CPUs
        memory=$((4 + (node_counter % 4) * 2))  # 4, 6, 8, or 10 Gi

        cat <<EOF | kubectl apply -f - > /dev/null
apiVersion: v1
kind: Node
metadata:
  name: ${node_name}
  annotations:
    node.alpha.kubernetes.io/ttl: "0"
    kwok.x-k8s.io/node: fake
  labels:
    topology.kubernetes.io/zone: ${zone}
    topology.kubernetes.io/region: us-east-1
    node.kubernetes.io/instance-type: t3.medium
    kubernetes.io/role: node
    kubernetes.io/hostname: ${node_name}
spec:
  taints:
    - effect: NoSchedule
      key: kwok.x-k8s.io/node
      value: fake
status:
  allocatable:
    cpu: "${cpu}"
    memory: ${memory}Gi
    pods: "110"
  capacity:
    cpu: "${cpu}"
    memory: ${memory}Gi
    pods: "110"
  nodeInfo:
    architecture: amd64
    bootID: ""
    containerRuntimeVersion: ""
    kernelVersion: ""
    kubeProxyVersion: v1.28.0-fake
    kubeletVersion: v1.28.0-fake
    machineID: ""
    operatingSystem: linux
    osImage: ""
    systemUUID: ""
  phase: Running
  conditions:
    - type: Ready
      status: "True"
      lastHeartbeatTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
      lastTransitionTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
      reason: KubeletReady
      message: kubelet is ready
    - type: MemoryPressure
      status: "False"
      lastHeartbeatTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
      lastTransitionTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
      reason: KubeletHasSufficientMemory
      message: kubelet has sufficient memory available
    - type: DiskPressure
      status: "False"
      lastHeartbeatTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
      lastTransitionTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
      reason: KubeletHasNoDiskPressure
      message: kubelet has no disk pressure
    - type: PIDPressure
      status: "False"
      lastHeartbeatTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
      lastTransitionTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
      reason: KubeletHasSufficientPID
      message: kubelet has sufficient PID available
EOF

        ((node_counter++))
    done
done

echo -e "${GREEN}Creating test pods (~250 per node)...${NC}"

# Create a namespace for test pods
kubectl create namespace test-workload 2>/dev/null || true

# Get all nodes
nodes=($(kubectl get nodes -o jsonpath='{.items[*].metadata.name}'))

# Calculate total pods: 250 pods per node
PODS_PER_NODE=250
TOTAL_PODS=$((${#nodes[@]} * PODS_PER_NODE))

echo "Creating ${TOTAL_PODS} pods (${PODS_PER_NODE} per node)..."

# Create pods for each node
pod_counter=1
for node_name in "${nodes[@]}"; do
    echo "Creating ${PODS_PER_NODE} pods for ${node_name}..."

    for ((i=1; i<=PODS_PER_NODE; i++)); do
        # Vary pod phases
        if [ $((pod_counter % 50)) -eq 0 ]; then
            phase="Pending"
        elif [ $((pod_counter % 75)) -eq 0 ]; then
            phase="Failed"
        else
            phase="Running"
        fi

        pod_name=$(printf "test-pod-%05d" "$pod_counter")

    cat <<EOF | kubectl apply -f - > /dev/null 2>&1
apiVersion: v1
kind: Pod
metadata:
  name: ${pod_name}
  namespace: test-workload
spec:
  nodeName: ${node_name}
  containers:
  - name: app
    image: nginx:latest
    resources:
      requests:
        cpu: 100m
        memory: 128Mi
      limits:
        cpu: 200m
        memory: 256Mi
status:
  phase: ${phase}
  conditions:
  - type: Ready
    status: "$([ "$phase" == "Running" ] && echo "True" || echo "False")"
    lastProbeTime: null
    lastTransitionTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
  - type: ContainersReady
    status: "$([ "$phase" == "Running" ] && echo "True" || echo "False")"
    lastProbeTime: null
    lastTransitionTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
  - type: PodScheduled
    status: "True"
    lastProbeTime: null
    lastTransitionTime: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
  containerStatuses:
  - name: app
    ready: $([ "$phase" == "Running" ] && echo "true" || echo "false")
    restartCount: 0
    state:
      $([ "$phase" == "Running" ] && echo "running:" || echo "waiting:")
        $([ "$phase" == "Running" ] && echo "startedAt: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" || echo "reason: ContainerCreating")
EOF
        ((pod_counter++))
    done
done

# Summary
echo ""
echo -e "${GREEN}=== Cluster Setup Complete ===${NC}"
echo ""
echo "Cluster: ${CLUSTER_NAME}"
echo "Nodes: ${TOTAL_NODES} (across 3 zones)"
echo "Pods: ${TOTAL_PODS} (~${PODS_PER_NODE} per node in test-workload namespace)"
echo ""
echo "Zone distribution:"
kubectl get nodes -o custom-columns=ZONE:.metadata.labels."topology\.kubernetes\.io/zone" --no-headers | sort | uniq -c
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify cluster:"
echo "   kubectl get nodes -L topology.kubernetes.io/zone"
echo ""
echo "2. Check pods:"
echo "   kubectl get pods -n test-workload"
echo ""
echo "3. Connect threek8s to this cluster:"
echo "   - The kubeconfig is already set to use kwok-${CLUSTER_NAME} context"
echo "   - Start threek8s backend with: cd backend && npm run dev"
echo "   - Start threek8s frontend with: cd frontend && npm run dev"
echo ""
echo "4. To delete this cluster:"
echo "   ./scripts/cleanup-kwok-cluster.sh"
echo ""