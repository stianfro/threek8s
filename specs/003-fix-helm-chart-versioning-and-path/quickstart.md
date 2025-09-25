# Quickstart: Helm Chart Versioning and Publication Fix

## Prerequisites
- GitHub repository access with admin permissions
- Helm 3.8.0+ installed locally
- GitHub CLI (`gh`) for testing workflows

## Quick Validation Steps

### 1. Verify Configuration Changes
```bash
# Check release-please configuration
cat release-please-config.json | jq '.packages["."]["extra-files"][] | select(.path=="helm/threek8s/Chart.yaml")'

# Verify workflow environment variables
grep -E "(CHART_NAME|REGISTRY)" .github/workflows/publish-helm.yml

# Check OCI URL consistency
grep -n "oci://" .github/workflows/publish-helm.yml
```

### 2. Test Helm Chart Locally
```bash
# Lint the chart
helm lint helm/threek8s

# Package the chart
helm package helm/threek8s --destination /tmp

# Verify package
helm show chart /tmp/threek8s-*.tgz
```

### 3. Simulate Release Process
```bash
# Create a test tag to trigger workflow
git tag -a v999.0.0-test -m "Test chart publication"

# Push tag (triggers workflow)
git push origin v999.0.0-test

# Watch workflow execution
gh run watch

# Clean up test tag
git push --delete origin v999.0.0-test
git tag -d v999.0.0-test
```

## Installation Test

### After Fix is Deployed
```bash
# New installation command (after fix)
helm install threek8s oci://ghcr.io/stianfro/threek8s/chart --version 1.1.0

# Verify installation
helm list
kubectl get pods -l app=threek8s

# Upgrade test
helm upgrade threek8s oci://ghcr.io/stianfro/threek8s/chart --version 1.2.0
```

## Troubleshooting

### If Chart Push Fails
```bash
# Check registry login
echo $GITHUB_TOKEN | helm registry login ghcr.io --username $GITHUB_USER --password-stdin

# Verify registry permissions
gh api user/packages

# Manual push test
helm push /tmp/threek8s-*.tgz oci://ghcr.io/stianfro/threek8s/chart
```

### If Version Mismatch
```bash
# Check Chart.yaml versions
grep -E "(^version:|^appVersion:)" helm/threek8s/Chart.yaml

# Verify release-please PR updates
gh pr view --json files | jq '.files[] | select(.path=="helm/threek8s/Chart.yaml")'
```

## Success Criteria Checklist

- [ ] Release-please PR updates Chart.yaml version
- [ ] Workflow publishes to `ghcr.io/stianfro/threek8s/chart`
- [ ] Installation works with new OCI path
- [ ] Chart version matches release version
- [ ] No errors in publish-helm workflow
- [ ] Documentation shows correct paths

## Rollback Procedure

If issues occur after deployment:

1. **Revert the PR**
   ```bash
   gh pr revert <PR-NUMBER>
   ```

2. **Manual Chart Publication** (emergency)
   ```bash
   # Package chart manually
   helm package helm/threek8s

   # Push to registry manually
   helm push threek8s-*.tgz oci://ghcr.io/stianfro/threek8s/chart
   ```

3. **Update Documentation**
   - Notify users of temporary installation path
   - Document known issues in release notes

## Expected Outcomes

After successful implementation:
1. Every release automatically updates chart version
2. Chart publishes to `ghcr.io/stianfro/threek8s/chart`
3. Users can reliably install/upgrade via OCI registry
4. Version consistency between app and chart
5. Clear documentation for chart usage