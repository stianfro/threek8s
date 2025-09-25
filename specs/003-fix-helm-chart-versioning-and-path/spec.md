# Feature Specification: Fix Helm Chart Versioning and Publication Path

## Problem Statement

The Helm chart in the threek8s repository has two critical issues:

1. **Helm chart versioning is not working properly**: The chart version is not being correctly updated by release-please, leading to version mismatches between application releases and Helm chart releases.

2. **Chart is published to incorrect OCI registry path**: Currently the chart is being pushed to `ghcr.io/stianfro/threek8s` but referenced as `ghcr.io/stianfro/threek8s/threek8s`, creating a mismatch that prevents users from installing the chart. The desired path should be `ghcr.io/stianfro/threek8s/chart`.

## User Stories

### As a DevOps Engineer
- I want the Helm chart version to automatically update when a new release is created
- I want to install the Helm chart from a consistent and predictable OCI registry path
- I want the chart version to match the application version for consistency

### As a Release Manager
- I want release-please to properly manage both application and Helm chart versions
- I want the Helm chart to be published to the correct registry path on every release
- I want clear documentation on how to access and use the published Helm charts

## Functional Requirements

### FR1: Fix Helm Chart Versioning
- Release-please must update the Chart.yaml version field automatically
- Chart version should follow semantic versioning
- Chart appVersion should match the application version
- Version updates should trigger Helm chart publication workflow

### FR2: Fix OCI Registry Publication Path
- Helm chart should be published to `ghcr.io/stianfro/threek8s/chart`
- All references in documentation and workflows must use the correct path
- The push operation in publish-helm.yml must target the correct registry path
- Installation instructions must reference the correct OCI URL

### FR3: Workflow Integration
- publish-helm.yml workflow should be triggered by release-please releases
- Chart publication should happen automatically on version tags
- Workflow should validate chart before publication
- Failed publications should not break the release process

## Non-Functional Requirements

### NFR1: Compatibility
- Changes must be backward compatible with existing installations
- Migration path should be documented for users using the old registry path

### NFR2: Reliability
- Chart publication process must be idempotent
- Version conflicts should be detected and reported
- Registry push failures should be retried with appropriate backoff

### NFR3: Documentation
- README must be updated with correct installation instructions
- RELEASING.md should document the new chart publication process
- Helm chart README should include version compatibility matrix

## Technical Constraints

### TC1: GitHub Container Registry
- Must use GitHub Container Registry (ghcr.io) for OCI storage
- Must authenticate using GITHUB_TOKEN in workflows
- Package visibility should follow repository visibility settings

### TC2: Release Please
- Must integrate with existing release-please configuration
- Chart version bumps should follow conventional commits
- Version manifest must track chart versions separately if needed

### TC3: Helm Requirements
- Must support Helm 3.8.0 or later
- Chart must pass helm lint validation
- Must follow Helm best practices for OCI registries

## Success Criteria

1. ✓ Chart version in Chart.yaml is automatically updated by release-please
2. ✓ Helm chart is published to `ghcr.io/stianfro/threek8s/chart`
3. ✓ Users can install the chart using: `helm install threek8s oci://ghcr.io/stianfro/threek8s/chart`
4. ✓ Chart version matches application version in releases
5. ✓ All workflows pass without errors
6. ✓ Documentation reflects the correct registry paths

## Acceptance Criteria

### AC1: Version Management
- GIVEN a new commit with feat: or fix: prefix
- WHEN release-please creates a release PR
- THEN Chart.yaml version field is updated in the PR

### AC2: Registry Publication
- GIVEN a new release is published
- WHEN the publish-helm workflow runs
- THEN the chart is pushed to ghcr.io/stianfro/threek8s/chart

### AC3: Installation
- GIVEN the chart is published to the registry
- WHEN a user runs `helm install threek8s oci://ghcr.io/stianfro/threek8s/chart`
- THEN the chart installs successfully

### AC4: Version Verification
- GIVEN a release version v1.2.3
- WHEN checking the published chart
- THEN Chart.yaml shows version: 1.2.3 and appVersion: 1.2.3

## Dependencies

- GitHub Actions workflows
- GitHub Container Registry access
- release-please-action
- helm CLI tools
- GitHub token with package write permissions

## Out of Scope

- Migration of existing chart installations
- Support for multiple chart versions
- Chart repository index generation
- Helm chart signing and verification
- Support for other container registries

## Clarifications

### Session 1: Registry Path Structure

**Q: Should the chart be under a separate 'chart' namespace or 'helm' namespace in the registry?**
A: Use 'chart' as a suffix (ghcr.io/stianfro/threek8s/chart) to keep everything under the same repository namespace.

**Q: Should we maintain the old registry path for backward compatibility?**
A: No, clean break is preferred. Document the migration path in release notes.

**Q: Should chart versions be independent from application versions?**
A: No, keep them synchronized for simplicity. Both should use the same version number.

**Q: Do we need to support chart-specific version tags (e.g., chart-v1.0.0)?**
A: Yes, maintain support for chart-specific tags for emergency chart-only fixes.

**Q: Should failed chart publications block the main release process?**
A: No, chart publication failures should be logged but not block the release. Can be retried manually.