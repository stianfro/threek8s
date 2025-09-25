# Tasks: Release Artifacts Creation

**Input**: Design documents from `/specs/002-create-release-artifacts/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: Docker, Helm 3, GitHub Actions, Release Please
   → Project type: web (frontend + backend)
2. Load design documents:
   → data-model.md: DockerImage, HelmChart, ReleaseVersion entities
   → contracts/: 3 API contracts for GitHub Actions, Registry, Helm
   → quickstart.md: Installation and verification scenarios
3. Generate tasks by category:
   → Setup: Dockerfiles, build configs
   → Tests: Build validation, registry push tests
   → Core: GitHub Actions workflows, Helm chart
   → Integration: Release automation
   → Polish: Documentation, multi-arch support
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Infrastructure before automation
5. Number tasks sequentially (T001, T002...)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Backend**: `backend/` directory
- **Frontend**: `frontend/` directory
- **Helm**: `helm/` directory at repository root
- **Workflows**: `.github/workflows/` directory

## Phase 3.1: Docker Setup
- [x] T001 [P] Create backend/Dockerfile with multi-stage build for Node.js backend
- [x] T002 [P] Create frontend/Dockerfile with multi-stage build for Node.js frontend
- [x] T003 [P] Create .dockerignore files in backend/ and frontend/ directories
- [x] T004 Add Docker build scripts to backend/package.json and frontend/package.json

## Phase 3.2: Build Testing
- [x] T005 [P] Test backend Docker build locally with docker build backend/
- [x] T006 [P] Test frontend Docker build locally with docker build frontend/
- [x] T007 Verify images run correctly with docker-compose for local testing

## Phase 3.3: GitHub Actions Workflows
- [x] T008 Create .github/workflows/build-images.yml for Docker image builds
- [x] T009 Add multi-arch support (amd64, arm64) using docker/setup-buildx-action
- [x] T010 Create .github/workflows/publish-images.yml to push to ghcr.io
- [x] T011 Configure GitHub Actions secrets for GHCR authentication

## Phase 3.4: Helm Chart Creation
- [x] T012 Initialize Helm chart structure in helm/threek8s/
- [x] T013 [P] Create helm/threek8s/Chart.yaml with chart and app versions
- [x] T014 [P] Create helm/threek8s/values.yaml with environment variable defaults
- [x] T015 Create Kubernetes deployment templates in helm/threek8s/templates/
- [x] T016 Create service templates for frontend and backend
- [x] T017 Add configmap template for environment variables
- [x] T018 Create helm/threek8s/templates/NOTES.txt with deployment instructions

## Phase 3.5: Helm Publishing
- [x] T019 Create .github/workflows/publish-helm.yml for Helm chart OCI publishing
- [x] T020 Add Helm chart validation and linting in workflow
- [x] T021 Configure Helm push to ghcr.io/stianfro/threek8s/chart

## Phase 3.6: Release Automation
- [x] T022 Create .release-please-manifest.json for version tracking
- [x] T023 Create release-please-config.json with release configuration
- [x] T024 Create .github/workflows/release-please.yml for automated releases
- [x] T025 Configure Release Please to trigger image and chart builds on release

## Phase 3.7: Testing & Validation
- [x] T026 Create tests/release/test-helm-deployment.sh script
- [x] T027 Add smoke tests for published Docker images
- [x] T028 Validate multi-arch image manifests

## Phase 3.8: Documentation
- [x] T029 [P] Create helm/threek8s/README.md with Helm chart documentation
- [x] T030 [P] Update root README.md with release artifact information
- [x] T031 [P] Create RELEASING.md with release process documentation

## Dependencies
- Docker setup (T001-T004) before build testing (T005-T007)
- Build testing before GitHub Actions (T008-T011)
- GitHub Actions before Helm publishing (T019-T021)
- Helm chart creation (T012-T018) can parallel with Actions
- Release automation (T022-T025) requires Actions and Helm
- Testing after all publishing workflows
- Documentation can be parallel at the end

## Parallel Execution Examples

### Initial Docker Setup
```
# Launch T001-T003 together (different files):
Task: "Create backend/Dockerfile with multi-stage build"
Task: "Create frontend/Dockerfile with multi-stage build"
Task: "Create .dockerignore files"
```

### Helm Chart Basics
```
# Launch T013-T014 together (different files):
Task: "Create helm/threek8s/Chart.yaml"
Task: "Create helm/threek8s/values.yaml"
```

### Final Documentation
```
# Launch T029-T031 together (different files):
Task: "Create helm/threek8s/README.md"
Task: "Update root README.md"
Task: "Create RELEASING.md"
```

## Notes
- All Docker builds must support both amd64 and arm64
- Use Node.js 20-alpine as base image for smallest size
- GitHub Actions workflows need proper job dependencies
- Helm chart version can differ from app version
- Release Please handles semantic versioning automatically
- GHCR requires authentication via GITHUB_TOKEN
- Test locally before pushing to registry

## Validation Checklist
- [x] All contract APIs have implementation (GitHub Actions, Registry push)
- [x] All entities represented (DockerImage via Dockerfiles, HelmChart via helm/)
- [x] Infrastructure before automation ordering
- [x] Parallel tasks are truly independent files
- [x] Each task specifies exact file paths
- [x] No parallel tasks modify the same file

## Quick Test Commands
After implementation, validate with:
```bash
# Test Docker builds
docker build -t test-backend backend/
docker build -t test-frontend frontend/

# Test Helm chart
helm lint helm/threek8s/
helm install test-release helm/threek8s/ --dry-run

# Test GitHub Actions locally (with act)
act -j build-images
```