# Quickstart: ThreeK8s Release Artifacts

## Prerequisites
- Kubernetes cluster (1.24+)
- Helm 3.x installed
- kubectl configured
- (Optional) Docker for local testing

## Installation

### Quick Install (Recommended)
```bash
# Add the Helm repository (when using Helm repo, future enhancement)
# For now, install directly from OCI registry
helm install threek8s oci://ghcr.io/stianfro/threek8s/chart --version 1.0.0

# Verify installation
kubectl get pods -l app=threek8s
```

### Custom Configuration
```bash
# Create values override file
cat > my-values.yaml <<EOF
frontend:
  env:
    API_URL: https://api.example.com
backend:
  env:
    NODE_ENV: production
    LOG_LEVEL: info
EOF

# Install with custom values
helm install threek8s oci://ghcr.io/stianfro/threek8s/chart \
  --version 1.0.0 \
  --values my-values.yaml
```

## Verification Steps

### 1. Check Pod Status
```bash
# All pods should be Running
kubectl get pods -l app=threek8s
```
Expected output:
```
NAME                                READY   STATUS    RESTARTS   AGE
threek8s-frontend-xxx               1/1     Running   0          1m
threek8s-backend-xxx                1/1     Running   0          1m
```

### 2. Check Services
```bash
kubectl get svc -l app=threek8s
```

### 3. Access the Application
```bash
# Port-forward to access locally
kubectl port-forward svc/threek8s-frontend 3000:80 &
kubectl port-forward svc/threek8s-backend 8080:8080 &

# Open in browser
open http://localhost:3000
```

### 4. Verify Kubernetes Connection
The application should automatically connect to your current Kubernetes context and display cluster visualization.

## Using Docker Images Directly

### Pull Images
```bash
# Frontend
docker pull ghcr.io/stianfro/threek8s/frontend:1.0.0

# Backend
docker pull ghcr.io/stianfro/threek8s/backend:1.0.0
```

### Run Locally
```bash
# Backend
docker run -d \
  --name threek8s-backend \
  -p 8080:8080 \
  -e NODE_ENV=development \
  ghcr.io/stianfro/threek8s/backend:1.0.0

# Frontend
docker run -d \
  --name threek8s-frontend \
  -p 3000:80 \
  -e API_URL=http://localhost:8080 \
  ghcr.io/stianfro/threek8s/frontend:1.0.0
```

## Configuration Reference

### Environment Variables

#### Frontend
- `API_URL`: Backend API endpoint (default: `http://localhost:8080`)
- `NODE_ENV`: Environment mode (default: `production`)

#### Backend
- `NODE_ENV`: Environment mode (default: `production`)
- `PORT`: Server port (default: `8080`)
- `LOG_LEVEL`: Logging verbosity (default: `info`)
- `KUBECONFIG`: Path to kubeconfig (default: in-cluster config)

### Helm Values
```yaml
# Default values.yaml structure
frontend:
  image:
    repository: ghcr.io/stianfro/threek8s/frontend
    tag: 1.0.0
  service:
    port: 80
  env: {}

backend:
  image:
    repository: ghcr.io/stianfro/threek8s/backend
    tag: 1.0.0
  service:
    port: 8080
  env: {}

ingress:
  enabled: false
  className: nginx
  hosts: []
```

## Upgrade

### Using Helm
```bash
# Upgrade to new version
helm upgrade threek8s oci://ghcr.io/stianfro/threek8s/chart --version 1.1.0

# Rollback if needed
helm rollback threek8s
```

## Uninstall
```bash
helm uninstall threek8s
```

## Troubleshooting

### Pods not starting
```bash
# Check pod events
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>
```

### Registry authentication issues
```bash
# Login to ghcr.io if private
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin
```

### Version mismatch
```bash
# Check deployed versions
helm list
kubectl get deploy -o jsonpath='{.items[*].spec.template.spec.containers[*].image}'
```

## Test Scenarios

### Scenario 1: Basic Deployment
1. Install with default values
2. Verify all pods are running
3. Access the UI
4. Confirm cluster visualization works

### Scenario 2: Custom Configuration
1. Create custom values file
2. Deploy with overrides
3. Verify environment variables are set
4. Check application behavior matches configuration

### Scenario 3: Multi-Architecture
1. Deploy to ARM64 cluster
2. Verify correct image architecture pulled
3. Check performance and functionality

### Scenario 4: Upgrade Path
1. Deploy version 1.0.0
2. Upgrade to 1.1.0
3. Verify zero-downtime upgrade
4. Test rollback capability