# Changelog

## [1.5.0](https://github.com/stianfro/threek8s/compare/v1.4.1...v1.5.0) (2025-10-01)


### Features

* add optional OIDC authentication support ([#40](https://github.com/stianfro/threek8s/issues/40)) ([8a3f691](https://github.com/stianfro/threek8s/commit/8a3f691dc48a0457a7d10dafe27c1bc0b286ae23))
* implement comprehensive security improvements ([#41](https://github.com/stianfro/threek8s/issues/41)) ([ef823e7](https://github.com/stianfro/threek8s/commit/ef823e75f95602af626977e45d7499230d8d106f))


### Bug Fixes

* add security-events permission to release workflow ([#42](https://github.com/stianfro/threek8s/issues/42)) ([f2ab321](https://github.com/stianfro/threek8s/commit/f2ab321440d8d0d4749346e04c1454d75259ff3a))
* allow releases to proceed despite Trivy vulnerabilities ([#39](https://github.com/stianfro/threek8s/issues/39)) ([d87b07c](https://github.com/stianfro/threek8s/commit/d87b07cdd13576b0235a5a3af04ccbcab1155459))

## [1.4.1](https://github.com/stianfro/threek8s/compare/v1.4.0...v1.4.1) (2025-09-30)


### Bug Fixes

* resolve 9 GitHub security issues ([#37](https://github.com/stianfro/threek8s/issues/37)) ([20aece3](https://github.com/stianfro/threek8s/commit/20aece304608e421e6c82d079ef091cc02eee912))

## [1.4.0](https://github.com/stianfro/threek8s/compare/v1.3.0...v1.4.0) (2025-09-30)


### Features

* implement comprehensive security scanning ([#35](https://github.com/stianfro/threek8s/issues/35)) ([00fea13](https://github.com/stianfro/threek8s/commit/00fea138bb6066b4669a437f9723ab08ec488f13))


### Bug Fixes

* update Docker base images and apply security patches ([#36](https://github.com/stianfro/threek8s/issues/36)) ([ee83b4d](https://github.com/stianfro/threek8s/commit/ee83b4dba559f6e8cb229daa9fc5eabc5d428c2e))


### Documentation

* update readme ([7ecd3b7](https://github.com/stianfro/threek8s/commit/7ecd3b72b31ccf321102adf33bfbadecdfd8354f))

## [1.3.0](https://github.com/stianfro/threek8s/compare/v1.2.3...v1.3.0) (2025-09-30)


### Features

* implement zone-based node grouping with visual labels ([#33](https://github.com/stianfro/threek8s/issues/33)) ([b1e375f](https://github.com/stianfro/threek8s/commit/b1e375febe3fe30d2189cca3d7923a02a7096fc4))


### Documentation

* update readme ([463c571](https://github.com/stianfro/threek8s/commit/463c5718101614e074a19cd0017b98235f055ba8))

## [1.2.3](https://github.com/stianfro/threek8s/compare/v1.2.2...v1.2.3) (2025-09-26)


### Bug Fixes

* restore pod hover and add node hover functionality ([#28](https://github.com/stianfro/threek8s/issues/28)) ([86d46ff](https://github.com/stianfro/threek8s/commit/86d46ff4fa832d4829357fefb108325917d6cf1a))

## [1.2.2](https://github.com/stianfro/threek8s/compare/v1.2.1...v1.2.2) (2025-09-26)


### Bug Fixes

* potential fix for code scanning alert no. 2: Use of externally-controlled format string ([#9](https://github.com/stianfro/threek8s/issues/9)) ([4144fd0](https://github.com/stianfro/threek8s/commit/4144fd02894687dc687bb769eb7f281ea6c02dc6))
* potential fix for code scanning alert no. 3: Use of externally-controlled format string ([#8](https://github.com/stianfro/threek8s/issues/8)) ([9f36ad5](https://github.com/stianfro/threek8s/commit/9f36ad559af0d1dcb1c2b8dac2b138d2404df0fe))


### Build System

* fix Helm chart publication path from threek8s/chart/threek8s to threek8s/threek8s ([#26](https://github.com/stianfro/threek8s/issues/26)) ([9d2d534](https://github.com/stianfro/threek8s/commit/9d2d53423fa8733fc05a6d1d26fc79e198cb176d))

## [1.2.1](https://github.com/stianfro/threek8s/compare/v1.2.0...v1.2.1) (2025-09-26)


### Bug Fixes

* improve initial zoom and prevent node resizing after viewport setup ([#24](https://github.com/stianfro/threek8s/issues/24)) ([55803ef](https://github.com/stianfro/threek8s/commit/55803ef5c7e65de9a49a779531a77168daf28283))


### Continuous Integration

* remove frontend image smoke test from CI workflow ([#22](https://github.com/stianfro/threek8s/issues/22)) ([0a7b29f](https://github.com/stianfro/threek8s/commit/0a7b29f5ba3f7ef1cb556920b43770ba53ffffcb))

## [1.2.0](https://github.com/stianfro/threek8s/compare/v1.1.4...v1.2.0) (2025-09-26)


### Features

* optimize initial zoom and LOD thresholds for better visibility ([#20](https://github.com/stianfro/threek8s/issues/20)) ([6881552](https://github.com/stianfro/threek8s/commit/6881552790c6f46f9df653f931bfc10831294712))

## [1.1.4](https://github.com/stianfro/threek8s/compare/v1.1.3...v1.1.4) (2025-09-25)


### Bug Fixes

* resolve performance issues with large Kubernetes clusters ([45dd7fd](https://github.com/stianfro/threek8s/commit/45dd7fd08e25f37bcbdd82d434e2952f691724a0))

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
