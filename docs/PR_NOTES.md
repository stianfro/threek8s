# PR Notes: Fix Helm Chart Versioning and Publication Path

## Summary

This PR fixes two critical issues with the Helm chart:
1. Chart versioning not being updated by release-please
2. Chart publishing to incorrect OCI registry path

## Changes Made

### Configuration Updates
- Updated `CHART_NAME` environment variable from "threek8s" to "chart" in publish-helm.yml
- Fixed all OCI registry URLs to use `ghcr.io/stianfro/threek8s/chart`
- Verified release-please configuration correctly updates Chart.yaml

### Documentation Updates
- Updated README.md with correct Helm installation commands
- Enhanced RELEASING.md with detailed chart publication workflow
- Created migration guide in docs/HELM_MIGRATION.md

## Testing Performed

- ✅ Workflow syntax validation passed
- ✅ Helm chart linting successful
- ✅ Chart packaging works correctly
- ✅ All OCI URLs are consistent
- ✅ Release-please configuration verified

## How to Test

1. Create a test tag to verify workflow:
```bash
git tag -a v999.0.0-test -m "Test chart publication"
git push origin v999.0.0-test
```

2. Watch the workflow execution:
```bash
gh run watch
```

3. Clean up test tag:
```bash
git push --delete origin v999.0.0-test
git tag -d v999.0.0-test
```

## Expected Outcome

After this PR is merged:
- Helm chart will publish to `ghcr.io/stianfro/threek8s/chart`
- Users can install with: `helm install threek8s oci://ghcr.io/stianfro/threek8s/chart`
- Chart versions will automatically sync with application versions via release-please

## Breaking Changes

None - the old path was already broken, so this is a fix rather than a breaking change.