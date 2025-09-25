# Helm Chart Migration Guide

## Overview

The Helm chart publication path for threek8s has been updated to fix versioning issues and align with best practices for OCI registry organization.

## Migration Details

### Old Path (Non-functional)
- Registry Path: `ghcr.io/stianfro/threek8s/threek8s`
- Issue: Chart was pushed to wrong path, causing installation failures

### New Path (Fixed)
- Registry Path: `ghcr.io/stianfro/threek8s/chart`
- Status: ✅ Fully functional

## Installation Instructions

### New Installation

```bash
# Install the latest version
helm install threek8s oci://ghcr.io/stianfro/threek8s/chart

# Install a specific version
helm install threek8s oci://ghcr.io/stianfro/threek8s/chart --version 1.1.0

# Install with custom values
helm install threek8s oci://ghcr.io/stianfro/threek8s/chart -f values.yaml
```

### Upgrading Existing Installation

If you have an existing installation (unlikely due to previous path issues), you can upgrade:

```bash
# Upgrade to latest version
helm upgrade threek8s oci://ghcr.io/stianfro/threek8s/chart

# Upgrade to specific version
helm upgrade threek8s oci://ghcr.io/stianfro/threek8s/chart --version 1.2.0
```

## Verification

To verify the chart is available:

```bash
# Show chart information
helm show chart oci://ghcr.io/stianfro/threek8s/chart

# Show chart values
helm show values oci://ghcr.io/stianfro/threek8s/chart
```

## Version Management

The chart version is now automatically managed by release-please:
- Chart version matches the application version
- Every release automatically updates both `version` and `appVersion` in Chart.yaml
- Version consistency is maintained across all components

## Troubleshooting

### Authentication Issues

If you encounter authentication issues:

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | helm registry login ghcr.io --username $GITHUB_USER --password-stdin
```

### Version Mismatch

The chart version should always match the application version. Check current versions:

```bash
# Check chart version
helm show chart oci://ghcr.io/stianfro/threek8s/chart | grep version

# Check application version
helm show chart oci://ghcr.io/stianfro/threek8s/chart | grep appVersion
```

## Support

For issues or questions:
- Check the [Release Notes](https://github.com/stianfro/threek8s/releases)
- Open an issue on [GitHub](https://github.com/stianfro/threek8s/issues)

## Timeline

- **Before v1.2.0**: Chart publication was broken
- **v1.2.0 and later**: Chart publishes to correct path automatically