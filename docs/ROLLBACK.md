# Rollback Procedures for Helm Chart Changes

## When to Rollback

Consider rollback if any of the following occur after deployment:
- Helm chart fails to publish to the new registry path
- Version synchronization breaks between app and chart
- Users report installation issues with the new path

## Rollback Steps

### 1. Revert GitHub Workflow Changes

If the workflow changes cause issues:

```bash
# Revert the PR that made the changes
gh pr revert <PR-NUMBER>

# Or manually revert the workflow file
git revert <commit-hash>
git push origin main
```

### 2. Emergency Manual Chart Publication

If automated publishing fails but you need to release a chart immediately:

```bash
# Package the chart locally
cd helm/threek8s
helm package .

# Login to GitHub Container Registry
echo $GITHUB_TOKEN | helm registry login ghcr.io --username $GITHUB_USER --password-stdin

# Push manually to the registry
helm push threek8s-*.tgz oci://ghcr.io/stianfro/threek8s/chart
```

### 3. Temporary Workaround Instructions

If users need to install while the issue is being fixed:

```bash
# Option 1: Install from GitHub repository directly
git clone https://github.com/stianfro/threek8s.git
helm install threek8s ./threek8s/helm/threek8s

# Option 2: Download chart manually
wget https://github.com/stianfro/threek8s/archive/refs/tags/v<VERSION>.tar.gz
tar -xzf v<VERSION>.tar.gz
helm install threek8s ./threek8s-<VERSION>/helm/threek8s
```

## Verification After Rollback

1. **Check Workflow Status**
```bash
gh workflow view publish-helm.yml
gh run list --workflow publish-helm.yml
```

2. **Verify Chart Availability**
```bash
helm show chart oci://ghcr.io/stianfro/threek8s/chart
```

3. **Test Installation**
```bash
helm install test-rollback oci://ghcr.io/stianfro/threek8s/chart --dry-run
```

## Prevention Measures

To avoid needing rollback:
1. Always test workflow changes in a feature branch first
2. Use workflow_dispatch to manually test before merging
3. Create test tags to verify the full flow
4. Monitor the first few releases after changes

## Support

If rollback is needed:
1. Create an incident issue in GitHub
2. Tag it as `priority: high` and `type: incident`
3. Notify users via release notes or status page
4. Document lessons learned after resolution

## Recovery Timeline

- **Immediate** (5 min): Revert PR if workflow is broken
- **Quick** (30 min): Manual chart publication if needed
- **Full** (1-2 hours): Complete fix and re-deployment

## Contact

For urgent issues:
- Open issue: https://github.com/stianfro/threek8s/issues
- Check status: https://github.com/stianfro/threek8s/actions