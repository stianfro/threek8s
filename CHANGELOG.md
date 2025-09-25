# Changelog

## [1.1.3](https://github.com/stianfro/threek8s/compare/v1.1.2...v1.1.3) (2025-09-25)


### Bug Fixes

* resolve pod-node alignment issues in viewport visualization ([#17](https://github.com/stianfro/threek8s/issues/17)) ([50d92ff](https://github.com/stianfro/threek8s/commit/50d92ff49429df0f37f3504ae9a9d98f473b948f))

## [1.1.2](https://github.com/stianfro/threek8s/compare/v1.1.1...v1.1.2) (2025-09-25)


### Bug Fixes

* correct Helm chart OCI registry path and versioning ([#15](https://github.com/stianfro/threek8s/issues/15)) ([5a63236](https://github.com/stianfro/threek8s/commit/5a63236753aa2170b42d4081ac8232809cf16454))

## [1.1.1](https://github.com/stianfro/threek8s/compare/v1.1.0...v1.1.1) (2025-09-25)


### Bug Fixes

* add root-level health check endpoints for Kubernetes probes ([627346f](https://github.com/stianfro/threek8s/commit/627346fd5982eecc7e5dd27ee5a95ed92801939f))
* implement dynamic node scaling and viewport adjustment ([ef4568e](https://github.com/stianfro/threek8s/commit/ef4568e0f9b4871eb273d8c1546c7088e6d96666))


### Miscellaneous

* update values ([dc03e04](https://github.com/stianfro/threek8s/commit/dc03e04abd61333f419252cfeb3b7373134a14e6))

## [1.1.0](https://github.com/stianfro/threek8s/compare/v1.0.6...v1.1.0) (2025-09-25)


### Features

* implement runtime configuration for frontend ([8f5b4d4](https://github.com/stianfro/threek8s/commit/8f5b4d4b9cc71b3e9ae8d7744aa5de1b6fd03c1f))


### Bug Fixes

* make frontend OpenShift compatible by using port 8080 ([7a5599c](https://github.com/stianfro/threek8s/commit/7a5599c0650753374882b150e344b1d9f5d98b34))
* reduce backend resource requirements and update default CORS ([bbbca09](https://github.com/stianfro/threek8s/commit/bbbca09b8228221c329058f0dbfc70887729f3fd))
* remove incorrect KUBECONFIG_PATH env var and update docs ([b425dfd](https://github.com/stianfro/threek8s/commit/b425dfd68cc2b864886b639af7e5c77978549e5c))
* significantly reduce resource requests and remove limits ([e70eb7f](https://github.com/stianfro/threek8s/commit/e70eb7f99b0f2360c8c8b63b5c92ee3695b58dcb))

## [1.0.6](https://github.com/stianfro/threek8s/compare/v1.0.5...v1.0.6) (2025-09-25)


### Bug Fixes

* properly version Helm chart and use specific image tags ([1d670d5](https://github.com/stianfro/threek8s/commit/1d670d5bb02cb679a1bb721549f1c0e337e832c3))

## [1.0.5](https://github.com/stianfro/threek8s/compare/v1.0.4...v1.0.5) (2025-09-25)


### Bug Fixes

* remove unnecessary image verification steps ([ea00243](https://github.com/stianfro/threek8s/commit/ea002436f3d99f620dd7dd46497b3a4a634e9b79))
* resolve Kubernetes deployment crashes in OpenShift ([2104597](https://github.com/stianfro/threek8s/commit/2104597237ab64f2bb0517313752a3a98155bd47))

## [1.0.4](https://github.com/stianfro/threek8s/compare/v1.0.3...v1.0.4) (2025-09-25)


### Bug Fixes

* remove ARM64 support and build only for amd64 ([b3a9544](https://github.com/stianfro/threek8s/commit/b3a954441b0ef2579c7e6101d593d07e3e83309c))

## [1.0.3](https://github.com/stianfro/threek8s/compare/v1.0.2...v1.0.3) (2025-09-25)


### Bug Fixes

* correct tag detection for workflow_call events ([f0cd2ad](https://github.com/stianfro/threek8s/commit/f0cd2ad72e8cec1eeb03591f197ca537dac70e1e))

## [1.0.2](https://github.com/stianfro/threek8s/compare/v1.0.1...v1.0.2) (2025-09-25)


### Bug Fixes

* correct GitHub Actions workflow conditions for releases ([4c5269d](https://github.com/stianfro/threek8s/commit/4c5269d934465d1348c4a39f9fbe8fa2781a15fd))

## [1.0.1](https://github.com/stianfro/threek8s/compare/v1.0.0...v1.0.1) (2025-09-25)


### Bug Fixes

* add id-token write permission to release-please workflow ([7f9d529](https://github.com/stianfro/threek8s/commit/7f9d529f2acecf7bf67a3e91cb77cc5113a2a656))
* trigger release ([f042852](https://github.com/stianfro/threek8s/commit/f042852c59cd1766938d543ab681c243e6153af3))
* update Release Please configuration for monorepo ([99b965a](https://github.com/stianfro/threek8s/commit/99b965a5f0c005d9fb3fbf2773cf214ab7d8b18e))


### Documentation

* update README with v1.0.0 deployment instructions ([42acadd](https://github.com/stianfro/threek8s/commit/42acaddf4531a103336f35194e7f93ee7d1a84df))


### Miscellaneous

* add project configuration and specification files ([#4](https://github.com/stianfro/threek8s/issues/4)) ([69a314b](https://github.com/stianfro/threek8s/commit/69a314b1cbc3a784998d8a7085e6f4e84af0d53b))
* add root .gitignore file ([4e14c69](https://github.com/stianfro/threek8s/commit/4e14c6927b5640ceedb6d2e7affc2ae9ef65d14e))
* **main:** release 1.0.0 ([#3](https://github.com/stianfro/threek8s/issues/3)) ([e585990](https://github.com/stianfro/threek8s/commit/e585990df8e25a6d389180198d7341a369a4c0ad))

## 1.0.0 (2025-09-25)


### Features

* implement complete release artifacts system ([#2](https://github.com/stianfro/threek8s/issues/2)) ([b8956f8](https://github.com/stianfro/threek8s/commit/b8956f8c4b38b58f5acfea08ec4f8cd992e106c6))
* implement ThreeK8s - 3D Kubernetes cluster visualization tool ([#1](https://github.com/stianfro/threek8s/issues/1)) ([8e460df](https://github.com/stianfro/threek8s/commit/8e460df0ded5ce19a88d70d9f48883188203b54e))
* update README with image ([16eb49a](https://github.com/stianfro/threek8s/commit/16eb49a282df30a3c46bb21a68a1cfc1cb1deefa))


### Bug Fixes

* add id-token write permission to release-please workflow ([7f9d529](https://github.com/stianfro/threek8s/commit/7f9d529f2acecf7bf67a3e91cb77cc5113a2a656))
* update Release Please configuration for monorepo ([99b965a](https://github.com/stianfro/threek8s/commit/99b965a5f0c005d9fb3fbf2773cf214ab7d8b18e))


### Documentation

* add MIT License to the project ([9f3b539](https://github.com/stianfro/threek8s/commit/9f3b539d20b4ecde8320a48f252f0c223bb493e5))
* update readme ([8a2de47](https://github.com/stianfro/threek8s/commit/8a2de479b2b3691a3884646550f632509fc4126f))
