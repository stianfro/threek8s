# GitHub Actions Workflows

## Overview

This directory contains GitHub Actions workflows for building, testing, and publishing the ThreeK8s application artifacts.

## Workflows

### ci.yml
- **Purpose**: Continuous Integration - build and test without pushing
- **Triggers**: Push to main/develop, pull requests, manual dispatch
- **Features**: Docker build validation, Helm chart linting, workflow validation

### publish-images.yml
- **Purpose**: Publish Docker images to GitHub Container Registry (ghcr.io)
- **Triggers**: Version tags (v*), releases, manual dispatch
- **Features**: Multi-arch push, provenance/SBOM generation, image verification

### publish-helm.yml
- **Purpose**: Publish Helm chart to OCI registry
- **Triggers**: Version tags, releases, manual dispatch
- **Features**: Chart validation, OCI publishing, version management

### release-please.yml
- **Purpose**: Automated release management with Release Please
- **Triggers**: Push to main branch
- **Features**: Semantic versioning, changelog generation, PR creation

## Required Secrets

### Automatic (provided by GitHub)
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions for:
  - Publishing to ghcr.io
  - Creating releases
  - Managing PRs

### Manual Configuration (if needed)
None required for public repositories. For private repositories or additional features:

1. **Container Registry Access**
   - The `GITHUB_TOKEN` is automatically configured with write access to packages
   - No additional configuration needed for ghcr.io

2. **Release Please**
   - Uses `GITHUB_TOKEN` for creating PRs and releases
   - Permissions are configured in workflow files

## Setting Up Secrets (if custom registry is used)

If you want to use a different container registry:

1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add the following (example for Docker Hub):
   - `DOCKER_USERNAME`: Your Docker Hub username
   - `DOCKER_PASSWORD`: Your Docker Hub password or access token

## Permissions

The workflows use the following permissions:
- **contents**: read (checkout code)
- **packages**: write (publish to ghcr.io)
- **pull-requests**: write (for Release Please)
- **id-token**: write (for provenance/SBOM)

## Testing Workflows Locally

Use [act](https://github.com/nektos/act) to test workflows locally:

```bash
# Test build workflow
act -j build --container-architecture linux/amd64

# Test with secrets
act -j publish --secret-file .secrets
```

## Multi-Architecture Support

All image builds support:
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM 64-bit)

This is achieved using:
- Docker Buildx
- QEMU for cross-platform emulation
- Multi-platform manifests

## Image Naming Convention

Images are published to:
- Backend: `ghcr.io/stianfro/threek8s/backend:<tag>`
- Frontend: `ghcr.io/stianfro/threek8s/frontend:<tag>`
- Helm Chart: `ghcr.io/stianfro/threek8s/chart:<version>`

Tags follow semantic versioning:
- `latest`: Latest stable release
- `v1.2.3`: Specific version
- `1.2`: Major.minor version
- `1`: Major version only
- `main-sha`: Branch with commit SHA

## Troubleshooting

### Build Failures
- Check Docker build context and Dockerfile syntax
- Verify all required files are present
- Check for platform-specific issues

### Publishing Failures
- Verify GitHub token has package write permissions
- Check registry quota and limits
- Ensure version tags follow semantic versioning

### Multi-arch Issues
- Ensure buildx is properly configured
- Check QEMU setup for cross-platform builds
- Verify base images support target architectures