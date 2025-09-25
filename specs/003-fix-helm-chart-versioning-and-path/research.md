# Research: Fix Helm Chart Versioning and Publication Path

## Current State Analysis

### Release Please Configuration
**Decision**: Keep release-please managing Chart.yaml versioning
**Rationale**: Release-please already configured to update Chart.yaml via extra-files
**Finding**: Lines 41-48 in release-please-config.json show Chart.yaml is tracked for both version and appVersion

### GitHub Actions Workflow Issues
**Decision**: Fix OCI registry push and reference paths
**Rationale**: Current workflow has mismatched push/pull paths causing installation failures
**Current Issues**:
- Line 163: Pushes to `oci://ghcr.io/stianfro/threek8s` (missing chart name)
- Lines 167, 199, 202, 208: Reference `oci://ghcr.io/stianfro/threek8s/threek8s` (double chart name)
- Desired: All operations should use `oci://ghcr.io/stianfro/threek8s/chart`

### OCI Registry Best Practices
**Decision**: Use repository/chart pattern for OCI paths
**Rationale**: Keeps chart under same repository namespace, clearly distinguishes from container images
**Standard**: `oci://ghcr.io/{owner}/{repository}/chart` for Helm charts
**Alternatives Considered**:
- `oci://ghcr.io/{owner}/charts/{chartname}` - Rejected: Splits across namespaces
- `oci://ghcr.io/{owner}/{repository}/helm/{chartname}` - Rejected: Unnecessarily deep

### Version Synchronization Strategy
**Decision**: Single version source of truth via release-please
**Rationale**: Prevents version drift between app and chart
**Implementation**:
- Release-please updates all version fields
- publish-helm.yml reads versions from updated files
- No manual version overrides except for chart-specific emergency fixes

### Backward Compatibility
**Decision**: Clean break with documentation
**Rationale**: Old path never worked correctly, no existing installations to migrate
**Migration**: Document new installation path in release notes and README

## Technical Decisions

### 1. Registry Path Structure
- **Choice**: `ghcr.io/stianfro/threek8s/chart`
- **Why**: Maintains repository namespace, clear separation from images
- **Implementation**: Update CHART_NAME env var and all OCI URLs

### 2. Version Management
- **Choice**: Release-please as single source of truth
- **Why**: Already configured, prevents drift
- **Implementation**: Ensure workflow reads from Chart.yaml, not override

### 3. Workflow Triggers
- **Choice**: Keep existing triggers (tags, releases, manual)
- **Why**: Provides flexibility for different release scenarios
- **Implementation**: No changes needed

### 4. Chart Naming
- **Choice**: Keep chart name as "threek8s"
- **Why**: Matches repository name, already established
- **Implementation**: Update registry path only, not chart name

## Implementation Requirements

### Files to Modify
1. `.github/workflows/publish-helm.yml` - Fix OCI registry paths
2. `release-please-config.json` - Verify Chart.yaml update config
3. `README.md` - Update installation instructions
4. `RELEASING.md` - Document chart publication process

### Validation Steps
1. Helm lint passes
2. Chart pushes to correct registry path
3. Chart pulls from correct registry path
4. Version in Chart.yaml matches release version
5. Installation instructions work

## Risk Assessment

### Low Risk
- Configuration-only changes
- No application code modifications
- Can be tested in CI before release

### Mitigations
- Test workflow changes in feature branch
- Validate with dry-run before actual release
- Document rollback procedure if needed