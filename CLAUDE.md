# threek8s Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-24

## Active Technologies
- JavaScript/TypeScript (ES2022+), Node.js 20+ + Three.js (3D visualization), @kubernetes/client-node (K8s API), Express/WebSocket (real-time) (001-create-an-application)
- JavaScript/TypeScript (ES2022+), Node.js 20+ (from existing codebase) + Docker, Helm 3, GitHub Actions, Release Please (002-create-release-artifacts)
- N/A (artifacts stored in ghcr.io registry) (002-create-release-artifacts)
- YAML/JSON (GitHub Actions, Helm, Release Please configs) + release-please-action v4, Helm 3.8.0+, GitHub Container Registry (003-fix-helm-chart-versioning-and-path)
- GitHub Container Registry (ghcr.io) for OCI artifacts (003-fix-helm-chart-versioning-and-path)
- N/A (real-time data from Kubernetes API) (005-fix-hover-info-pods-nodes)

## Project Structure
```
backend/
frontend/
tests/
```

## Commands
npm test [ONLY COMMANDS FOR ACTIVE TECHNOLOGIES][ONLY COMMANDS FOR ACTIVE TECHNOLOGIES] npm run lint

## Code Style
JavaScript/TypeScript (ES2022+), Node.js 20+: Follow standard conventions

## Recent Changes
- 005-fix-hover-info-pods-nodes: Added JavaScript/TypeScript (ES2022+), Node.js 20+ + Three.js (3D visualization), @kubernetes/client-node (K8s API), Express/WebSocket (real-time)
- 004-adjust-zoom-and-lod-thresholds: Added JavaScript/TypeScript (ES2022+), Node.js 20+ + Three.js (3D visualization), @kubernetes/client-node (K8s API), Express/WebSocket (real-time)
- 003-fix-helm-chart-versioning-and-path: Added YAML/JSON (GitHub Actions, Helm, Release Please configs) + release-please-action v4, Helm 3.8.0+, GitHub Container Registry

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
