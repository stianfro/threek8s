# Data Model: Release Artifacts

## Core Entities

### DockerImage
**Purpose**: Represents a container image for frontend or backend
**Fields**:
- `name`: string (e.g., "threek8s-frontend", "threek8s-backend")
- `tag`: string (semantic version, e.g., "1.0.0", "latest")
- `registry`: string (fixed: "ghcr.io/stianfro/threek8s")
- `architecture`: string[] (["amd64", "arm64"])
- `baseImage`: string (e.g., "node:20-alpine")
- `size`: number (bytes)
- `digest`: string (SHA256 hash)
- `buildDate`: timestamp
- `labels`: map<string, string> (OCI annotations)

**Validation**:
- Tag must follow semantic versioning or be "latest"
- Registry URL must be valid
- Architecture must include at least amd64
- Size must be positive
- Digest must be valid SHA256

### HelmChart
**Purpose**: Kubernetes deployment package
**Fields**:
- `name`: string (fixed: "threek8s")
- `chartVersion`: string (semantic version, e.g., "1.0.0")
- `appVersion`: string (semantic version, matches image tags)
- `description`: string
- `registry`: string (fixed: "ghcr.io/stianfro/threek8s/chart")
- `dependencies`: ChartDependency[]
- `values`: map<string, any> (default values)
- `templates`: string[] (list of template files)

**Validation**:
- Chart version must follow semantic versioning
- App version must match available image tags
- Values must include all required configurations
- Templates must be valid Kubernetes YAML

### ChartDependency
**Purpose**: External chart dependencies (if any)
**Fields**:
- `name`: string
- `version`: string
- `repository`: string
- `condition`: string (optional)

### ReleaseVersion
**Purpose**: Tracks releases created by Release Please
**Fields**:
- `version`: string (semantic version)
- `releaseDate`: timestamp
- `artifacts`: ReleaseArtifact[]
- `changelog`: string (markdown)
- `commitSHA`: string
- `prNumber`: number
- `releaseNotes`: string

**Validation**:
- Version must follow semantic versioning
- Must have at least one artifact
- Commit SHA must be valid Git hash

### ReleaseArtifact
**Purpose**: Individual artifact within a release
**Fields**:
- `type`: enum ["docker-frontend", "docker-backend", "helm-chart"]
- `uri`: string (full artifact URI)
- `checksum`: string (SHA256)
- `size`: number (bytes)

### EnvironmentVariable
**Purpose**: Configuration options for deployment
**Fields**:
- `name`: string (e.g., "API_URL", "NODE_ENV")
- `defaultValue`: string
- `description`: string
- `required`: boolean
- `scope`: enum ["frontend", "backend", "both"]
- `secret`: boolean (whether it contains sensitive data)

**Validation**:
- Name must follow UPPER_SNAKE_CASE convention
- Default value required unless marked as required
- Description must be provided

## Relationships

```
ReleaseVersion 1 ---> * ReleaseArtifact
ReleaseArtifact * ---> 1 DockerImage (for docker types)
ReleaseArtifact * ---> 1 HelmChart (for helm type)
HelmChart 1 ---> * ChartDependency
HelmChart 1 ---> * EnvironmentVariable
DockerImage * ---> * EnvironmentVariable
```

## State Transitions

### Release State Machine
```
draft -> pending -> building -> publishing -> published
                 \-> failed
```

### Image Build State Machine
```
queued -> building -> scanning -> pushing -> available
       \-> failed
```

### Chart Publish State Machine
```
validating -> packaging -> uploading -> indexed
          \-> invalid
```

## Constraints

1. **Version Consistency**: All artifacts in a release must share the same application version
2. **Multi-arch Manifest**: Docker images must provide a single manifest for all architectures
3. **Chart App Version**: Must reference existing, published Docker image versions
4. **Registry Namespace**: All artifacts under ghcr.io/stianfro/threek8s/*
5. **Tag Immutability**: Published tags cannot be overwritten (except "latest")
6. **Dependency Order**: Helm chart can only be published after Docker images are available