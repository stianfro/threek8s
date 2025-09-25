# Tasks: Fix Helm Chart Versioning and Publication Path

**Input**: Design documents from `/specs/003-fix-helm-chart-versioning-and-path/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: YAML/JSON configs, GitHub Actions, Helm, release-please
2. Load optional design documents:
   → data-model.md: Configuration entities and constraints
   → contracts/: Workflow and release-please validation rules
   → quickstart.md: Testing and validation procedures
3. Generate tasks by category:
   → Validation: Pre-flight checks for safety
   → Configuration: Update workflow and release configs
   → Documentation: Update installation instructions
   → Testing: Validate changes work correctly
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Validation before implementation
5. Number tasks sequentially (T001, T002...)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- Configuration files at repository root
- Workflows in `.github/workflows/`
- Helm chart in `helm/threek8s/`
- Documentation at repository root

## Phase 3.1: Pre-Implementation Validation
**CRITICAL: Run these checks before making any changes**
- [x] T001 [P] Validate current workflow syntax in .github/workflows/publish-helm.yml
- [x] T002 [P] Test Helm chart linting with `helm lint helm/threek8s`
- [x] T003 [P] Verify release-please config JSON schema in release-please-config.json
- [x] T004 [P] Check current Chart.yaml versions in helm/threek8s/Chart.yaml

## Phase 3.2: Configuration Updates
**IMPORTANT: These must be done sequentially to avoid conflicts**
- [x] T005 Update CHART_NAME env var from "threek8s" to "chart" in .github/workflows/publish-helm.yml (line 33)
- [x] T006 Fix OCI push URL to use /threek8s/chart in .github/workflows/publish-helm.yml (line 163)
- [x] T007 Fix OCI pull URL in helm show command in .github/workflows/publish-helm.yml (line 167)
- [x] T008 Fix OCI URLs in release notes section in .github/workflows/publish-helm.yml (lines 199, 202, 208)
- [x] T009 Verify release-please extra-files config for Chart.yaml updates in release-please-config.json

## Phase 3.3: Documentation Updates
**Can run in parallel as these are different files**
- [x] T010 [P] Update README.md with new Helm installation path `oci://ghcr.io/stianfro/threek8s/chart`
- [x] T011 [P] Update RELEASING.md with corrected chart publication workflow
- [x] T012 [P] Create migration notes in docs/HELM_MIGRATION.md for users

## Phase 3.4: Testing & Validation
**Run after configuration changes are complete**
- [x] T013 Test workflow syntax with `gh workflow view publish-helm.yml`
- [x] T014 Validate Helm chart packaging with `helm package helm/threek8s --destination /tmp`
- [x] T015 Test chart push simulation (dry-run) with mock registry
- [x] T016 Verify all OCI URLs are consistent with `grep -n "oci://" .github/workflows/publish-helm.yml`

## Phase 3.5: Final Verification
- [x] T017 Create test PR to trigger release-please and verify Chart.yaml updates
- [x] T018 Run full quickstart validation checklist from quickstart.md
- [x] T019 Document any rollback procedures if needed

## Dependencies
- Validation (T001-T004) must complete before configuration changes (T005-T009)
- T005 must complete before T006-T008 (depends on CHART_NAME variable)
- Configuration changes (T005-T009) before testing (T013-T016)
- All changes before final verification (T017-T019)

## Parallel Example
```
# Launch T001-T004 together (validation tasks):
Task: "Validate workflow syntax in .github/workflows/publish-helm.yml"
Task: "Test Helm chart linting with helm lint"
Task: "Verify release-please config JSON schema"
Task: "Check current Chart.yaml versions"

# Launch T010-T012 together (documentation):
Task: "Update README.md with new Helm installation path"
Task: "Update RELEASING.md with corrected workflow"
Task: "Create migration notes in docs/HELM_MIGRATION.md"
```

## Notes
- [P] tasks = different files, no dependencies
- Configuration changes are sequential due to same file modifications
- Test thoroughly before creating release
- Keep migration notes for users

## Task Generation Rules Applied
1. **From Contracts**:
   - workflow-contract.yaml → T001, T005-T008, T013, T016
   - release-please-contract.yaml → T003, T009, T017

2. **From Data Model**:
   - PublishWorkflow entity → T005-T008 (env vars and OCI URLs)
   - ReleaseConfig entity → T009 (extra-files validation)
   - ChartMetadata entity → T004 (version checks)

3. **From Quickstart**:
   - Validation steps → T001-T004
   - Testing procedures → T013-T016
   - Success criteria → T018
   - Rollback procedures → T019

4. **Ordering**:
   - Validation → Configuration → Documentation → Testing → Verification
   - Sequential for same-file edits, parallel for different files

## Validation Checklist
- [x] All contracts have corresponding tasks (workflow and release-please contracts covered)
- [x] All configuration entities have update tasks (env vars, OCI URLs, extra-files)
- [x] Validation comes before implementation (T001-T004 before T005-T009)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path or command
- [x] No [P] task modifies same file as another [P] task