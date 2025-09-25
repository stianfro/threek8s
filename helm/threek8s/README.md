# ThreeK8s Helm Chart

This Helm chart deploys ThreeK8s, a 3D Kubernetes cluster visualization tool, to a Kubernetes cluster.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- PV provisioner support in the underlying infrastructure (if persistence is enabled)

## Installing the Chart

To install the chart with the release name `threek8s`:

```bash
helm install threek8s ./helm/threek8s
```

The command deploys ThreeK8s on the Kubernetes cluster in the default configuration. The [Parameters](#parameters) section lists the parameters that can be configured during installation.

## Uninstalling the Chart

To uninstall/delete the `threek8s` deployment:

```bash
helm delete threek8s
```

The command removes all the Kubernetes components associated with the chart and deletes the release.

## Parameters

### Global parameters

| Name                      | Description                                     | Value |
| ------------------------- | ----------------------------------------------- | ----- |
| `global.imageRegistry`    | Global Docker image registry                    | `ghcr.io` |
| `global.imagePullSecrets` | Global Docker registry secret names as an array | `[]` |

### Frontend parameters

| Name                                     | Description                               | Value                          |
| ---------------------------------------- | ----------------------------------------- | ------------------------------ |
| `frontend.enabled`                       | Enable frontend deployment                | `true`                         |
| `frontend.image.registry`                | Frontend image registry                   | `ghcr.io`                      |
| `frontend.image.repository`              | Frontend image repository                 | `stianfro/threek8s/frontend`   |
| `frontend.image.tag`                     | Frontend image tag                        | `latest`                       |
| `frontend.image.pullPolicy`              | Frontend image pull policy                | `IfNotPresent`                 |
| `frontend.replicaCount`                  | Number of frontend replicas               | `1`                            |
| `frontend.service.type`                  | Frontend service type                     | `ClusterIP`                    |
| `frontend.service.port`                  | Frontend service port                     | `80`                           |
| `frontend.resources.limits.cpu`          | Frontend CPU limit                        | `500m`                         |
| `frontend.resources.limits.memory`       | Frontend memory limit                     | `512Mi`                        |
| `frontend.resources.requests.cpu`        | Frontend CPU request                      | `100m`                         |
| `frontend.resources.requests.memory`     | Frontend memory request                   | `128Mi`                        |

### Backend parameters

| Name                                     | Description                               | Value                          |
| ---------------------------------------- | ----------------------------------------- | ------------------------------ |
| `backend.enabled`                        | Enable backend deployment                 | `true`                         |
| `backend.image.registry`                 | Backend image registry                    | `ghcr.io`                      |
| `backend.image.repository`               | Backend image repository                  | `stianfro/threek8s/backend`    |
| `backend.image.tag`                      | Backend image tag                         | `latest`                       |
| `backend.image.pullPolicy`               | Backend image pull policy                 | `IfNotPresent`                 |
| `backend.replicaCount`                   | Number of backend replicas                | `1`                            |
| `backend.service.type`                   | Backend service type                      | `ClusterIP`                    |
| `backend.service.port`                   | Backend service port                      | `8080`                         |
| `backend.resources.limits.cpu`           | Backend CPU limit                         | `1000m`                        |
| `backend.resources.limits.memory`        | Backend memory limit                      | `1Gi`                          |
| `backend.resources.requests.cpu`         | Backend CPU request                       | `200m`                         |
| `backend.resources.requests.memory`      | Backend memory request                    | `256Mi`                        |

### RBAC parameters

| Name           | Description                     | Value  |
| -------------- | ------------------------------- | ------ |
| `rbac.create`  | Create RBAC resources           | `true` |

### Service Account parameters

| Name                         | Description                     | Value  |
| ---------------------------- | ------------------------------- | ------ |
| `serviceAccount.create`      | Create service account          | `true` |
| `serviceAccount.annotations` | Service account annotations     | `{}`   |
| `serviceAccount.name`        | Service account name            | `""`   |

### Ingress parameters

| Name                  | Description                                         | Value           |
| --------------------- | --------------------------------------------------- | --------------- |
| `ingress.enabled`     | Enable ingress record generation                    | `false`         |
| `ingress.className`   | IngressClass that will be used                      | `""`            |
| `ingress.annotations` | Additional annotations for the Ingress resource     | `{}`            |
| `ingress.hosts`       | An array with the hostname(s) to be covered        | `[threek8s.local]` |
| `ingress.tls`         | TLS configuration for additional hostname(s)        | `[]`            |

### Autoscaling parameters

| Name                                                  | Description                                  | Value   |
| ----------------------------------------------------- | -------------------------------------------- | ------- |
| `autoscaling.frontend.enabled`                       | Enable frontend autoscaling                  | `false` |
| `autoscaling.frontend.minReplicas`                   | Minimum number of frontend replicas          | `1`     |
| `autoscaling.frontend.maxReplicas`                   | Maximum number of frontend replicas          | `10`    |
| `autoscaling.frontend.targetCPUUtilizationPercentage`| Target CPU utilization percentage            | `80`    |
| `autoscaling.backend.enabled`                        | Enable backend autoscaling                   | `false` |
| `autoscaling.backend.minReplicas`                    | Minimum number of backend replicas           | `1`     |
| `autoscaling.backend.maxReplicas`                    | Maximum number of backend replicas           | `5`     |
| `autoscaling.backend.targetCPUUtilizationPercentage` | Target CPU utilization percentage            | `80`    |

## Configuration and Installation Examples

### Basic Installation

```bash
helm install threek8s ./helm/threek8s
```

### With Custom Values

```bash
helm install threek8s ./helm/threek8s \
  --set frontend.replicaCount=2 \
  --set backend.replicaCount=2 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=threek8s.example.com
```

### With Values File

Create a `values-production.yaml`:

```yaml
frontend:
  replicaCount: 3
  resources:
    requests:
      memory: "256Mi"
      cpu: "200m"
    limits:
      memory: "512Mi"
      cpu: "500m"

backend:
  replicaCount: 2
  resources:
    requests:
      memory: "512Mi"
      cpu: "300m"
    limits:
      memory: "1Gi"
      cpu: "1000m"

ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: threek8s.example.com
      paths:
        - path: /
          pathType: Prefix
          service:
            name: threek8s-frontend
            port: 80

autoscaling:
  frontend:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
  backend:
    enabled: true
    minReplicas: 2
    maxReplicas: 5
```

Install with:

```bash
helm install threek8s ./helm/threek8s -f values-production.yaml
```

### Upgrading the Chart

```bash
helm upgrade threek8s ./helm/threek8s
```

### Running Tests

```bash
helm test threek8s
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -l app.kubernetes.io/instance=threek8s
```

### View Logs

```bash
# Frontend logs
kubectl logs -l app.kubernetes.io/name=threek8s,app.kubernetes.io/component=frontend

# Backend logs
kubectl logs -l app.kubernetes.io/name=threek8s,app.kubernetes.io/component=backend
```

### Access Application Locally

```bash
kubectl port-forward svc/threek8s-frontend 8080:80
```

Then visit http://localhost:8080

## Security Considerations

The chart creates RBAC resources that allow the backend to read Kubernetes resources. Review the permissions in `values.yaml` under `rbac.rules` to ensure they meet your security requirements.

## License

This chart is licensed under the MIT License.