# Tasks: Kubernetes Cluster 3D Visualization

**Input**: Design documents from `/specs/001-create-an-application/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app structure**: `backend/`, `frontend/` at repository root
- TypeScript/JavaScript with Node.js backend and browser frontend

## Phase 3.1: Setup
- [x] T001 Create project structure with backend/ and frontend/ directories per plan.md
- [x] T002 Initialize backend Node.js project with package.json in backend/
- [x] T003 Initialize frontend Vite + TypeScript project in frontend/
- [x] T004 [P] Install backend dependencies: express, ws, @kubernetes/client-node, typescript in backend/
- [x] T005 [P] Install frontend dependencies: three, vite, typescript in frontend/
- [x] T006 [P] Configure TypeScript with tsconfig.json in backend/
- [x] T007 [P] Configure TypeScript with tsconfig.json in frontend/
- [x] T008 [P] Setup ESLint and Prettier in backend/
- [x] T009 [P] Setup ESLint and Prettier in frontend/
- [x] T010 [P] Create .env.example with KUBECONFIG_PATH in backend/

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests
- [x] T011 [P] WebSocket connection test in backend/tests/contract/websocket-connection.test.ts
- [x] T012 [P] WebSocket initial_state message test in backend/tests/contract/websocket-initial-state.test.ts
- [x] T013 [P] WebSocket pod_event message test in backend/tests/contract/websocket-pod-event.test.ts
- [x] T014 [P] WebSocket node_event message test in backend/tests/contract/websocket-node-event.test.ts
- [x] T015 [P] REST API GET /api/health test in backend/tests/contract/api-health.test.ts
- [x] T016 [P] REST API GET /api/cluster/info test in backend/tests/contract/api-cluster-info.test.ts
- [x] T017 [P] REST API GET /api/nodes test in backend/tests/contract/api-nodes.test.ts
- [x] T018 [P] REST API GET /api/pods test in backend/tests/contract/api-pods.test.ts

### Integration Tests (from Quickstart scenarios)
- [x] T019 [P] Test basic cluster connectivity in backend/tests/integration/cluster-connection.test.ts
- [x] T020 [P] Test real-time pod creation updates in backend/tests/integration/pod-creation.test.ts
- [ ] T021 [P] Test pod deletion animations in frontend/tests/integration/pod-deletion.test.ts
- [ ] T022 [P] Test hover information display in frontend/tests/integration/hover-info.test.ts

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Backend Data Models
- [x] T023 [P] Create KubernetesNode model in backend/src/models/KubernetesNode.ts
- [x] T024 [P] Create Pod model in backend/src/models/Pod.ts
- [x] T025 [P] Create Namespace model in backend/src/models/Namespace.ts
- [x] T026 [P] Create ClusterState model in backend/src/models/ClusterState.ts
- [x] T027 [P] Create value objects (Vector3, ResourceInfo) in backend/src/models/ValueObjects.ts
- [x] T028 [P] Create event types (WatchEvent, EventType) in backend/src/models/Events.ts

### Backend Services
- [x] T029 Create KubernetesService for cluster connection in backend/src/services/KubernetesService.ts
- [ ] T030 Create WatchManager for K8s watch streams in backend/src/services/WatchManager.ts
- [x] T031 Create StateManager for cluster state in backend/src/services/StateManager.ts
- [ ] T032 Create WebSocketManager for client connections in backend/src/services/WebSocketManager.ts
- [ ] T033 Create EventProcessor for watch events in backend/src/services/EventProcessor.ts

### Backend API Implementation
- [ ] T034 Implement WebSocket server with connection handling in backend/src/websocket/server.ts
- [ ] T035 Implement initial_state message handler in backend/src/websocket/handlers/initialState.ts
- [ ] T036 Implement resource event broadcasting in backend/src/websocket/handlers/events.ts
- [ ] T037 Implement heartbeat/ping-pong in backend/src/websocket/handlers/heartbeat.ts
- [ ] T038 Implement REST API health endpoint in backend/src/api/routes/health.ts
- [ ] T039 Implement REST API cluster info endpoint in backend/src/api/routes/cluster.ts
- [ ] T040 Implement REST API nodes endpoint in backend/src/api/routes/nodes.ts
- [ ] T041 Implement REST API pods endpoint in backend/src/api/routes/pods.ts
- [ ] T042 Create Express app with routing in backend/src/app.ts
- [ ] T043 Create server entry point in backend/src/index.ts

### Frontend Core Components
- [ ] T044 [P] Create Three.js scene setup in frontend/src/scene/SceneManager.ts
- [ ] T045 [P] Create node visualization (boxes) in frontend/src/objects/NodeObject.ts
- [ ] T046 [P] Create pod visualization (smaller boxes) in frontend/src/objects/PodObject.ts
- [ ] T047 [P] Create camera controls in frontend/src/controls/CameraControls.ts
- [ ] T048 [P] Create hover interaction manager in frontend/src/interaction/HoverManager.ts
- [ ] T049 [P] Create animation system in frontend/src/animation/AnimationManager.ts
- [ ] T050 [P] Create layout algorithm in frontend/src/layout/LayoutEngine.ts

### Frontend Services
- [ ] T051 Create WebSocket client service in frontend/src/services/WebSocketService.ts
- [ ] T052 Create state management for cluster data in frontend/src/state/ClusterStore.ts
- [ ] T053 Create event handler for real-time updates in frontend/src/services/EventHandler.ts

### Frontend UI Components
- [ ] T054 Create main App component in frontend/src/App.tsx
- [ ] T055 Create 3D viewport component in frontend/src/components/Viewport.tsx
- [ ] T056 Create tooltip/hover info component in frontend/src/components/Tooltip.tsx
- [ ] T057 Create connection status indicator in frontend/src/components/ConnectionStatus.tsx
- [ ] T058 Create error boundary component in frontend/src/components/ErrorBoundary.tsx

## Phase 3.4: Integration
- [ ] T059 Connect KubernetesService to kubeconfig in backend/src/services/KubernetesService.ts
- [ ] T060 Wire up watch streams to WebSocket broadcast in backend/src/services/WatchManager.ts
- [ ] T061 Add CORS middleware for frontend in backend/src/middleware/cors.ts
- [ ] T062 Add error handling middleware in backend/src/middleware/errorHandler.ts
- [ ] T063 Add request logging middleware in backend/src/middleware/logger.ts
- [ ] T064 Connect frontend WebSocket to backend in frontend/src/services/WebSocketService.ts
- [ ] T065 Wire up Three.js scene to cluster state in frontend/src/scene/SceneManager.ts
- [ ] T066 Add fade-in animation for new pods in frontend/src/animation/AnimationManager.ts
- [ ] T067 Add fade-out animation for deleted pods in frontend/src/animation/AnimationManager.ts
- [ ] T068 Add color coding for pod states in frontend/src/objects/PodObject.ts

## Phase 3.5: Polish
- [ ] T069 [P] Add unit tests for StateManager in backend/tests/unit/StateManager.test.ts
- [ ] T070 [P] Add unit tests for EventProcessor in backend/tests/unit/EventProcessor.test.ts
- [ ] T071 [P] Add unit tests for LayoutEngine in frontend/tests/unit/LayoutEngine.test.ts
- [ ] T072 [P] Add unit tests for AnimationManager in frontend/tests/unit/AnimationManager.test.ts
- [ ] T073 Performance test for 100 nodes rendering in frontend/tests/performance/large-cluster.test.ts
- [ ] T074 Add reconnection logic for WebSocket in frontend/src/services/WebSocketService.ts
- [ ] T075 Add loading states and skeletons in frontend/src/components/LoadingState.tsx
- [ ] T076 [P] Create README.md with setup instructions
- [ ] T077 [P] Create API documentation in docs/api.md
- [ ] T078 Run quickstart validation tests from quickstart.md

## Dependencies
- Setup (T001-T010) must complete first
- All tests (T011-T022) before any implementation (T023-T058)
- Backend models (T023-T028) can run parallel
- Backend services (T029-T033) depend on models
- WebSocket implementation (T034-T037) depends on services
- REST API (T038-T043) depends on services
- Frontend components can largely run in parallel
- Integration tasks (T059-T068) require core implementation
- Polish tasks (T069-T078) come last

## Parallel Execution Examples

### After Setup, Run Contract Tests Together:
```bash
# Launch T011-T018 together (all contract tests):
Task: "WebSocket connection test in backend/tests/contract/websocket-connection.test.ts"
Task: "WebSocket initial_state test in backend/tests/contract/websocket-initial-state.test.ts"
Task: "WebSocket pod_event test in backend/tests/contract/websocket-pod-event.test.ts"
Task: "WebSocket node_event test in backend/tests/contract/websocket-node-event.test.ts"
Task: "REST API health test in backend/tests/contract/api-health.test.ts"
Task: "REST API cluster info test in backend/tests/contract/api-cluster-info.test.ts"
Task: "REST API nodes test in backend/tests/contract/api-nodes.test.ts"
Task: "REST API pods test in backend/tests/contract/api-pods.test.ts"
```

### After Tests, Run Model Creation Together:
```bash
# Launch T023-T028 together (all models):
Task: "Create KubernetesNode model in backend/src/models/KubernetesNode.ts"
Task: "Create Pod model in backend/src/models/Pod.ts"
Task: "Create Namespace model in backend/src/models/Namespace.ts"
Task: "Create ClusterState model in backend/src/models/ClusterState.ts"
Task: "Create value objects in backend/src/models/ValueObjects.ts"
Task: "Create event types in backend/src/models/Events.ts"
```

### Frontend Components Can Run in Parallel:
```bash
# Launch T044-T050 together (frontend core):
Task: "Create Three.js scene in frontend/src/scene/SceneManager.ts"
Task: "Create node visualization in frontend/src/objects/NodeObject.ts"
Task: "Create pod visualization in frontend/src/objects/PodObject.ts"
Task: "Create camera controls in frontend/src/controls/CameraControls.ts"
Task: "Create hover manager in frontend/src/interaction/HoverManager.ts"
Task: "Create animation system in frontend/src/animation/AnimationManager.ts"
Task: "Create layout algorithm in frontend/src/layout/LayoutEngine.ts"
```

## Notes
- [P] tasks = different files, no shared dependencies
- Tests MUST fail before implementation starts
- Commit after each completed task
- WebSocket and REST endpoints tested separately
- Frontend and backend can progress in parallel after models
- Integration phase connects all components

## Validation Checklist
*GATE: All must be checked before execution*

- [x] All WebSocket contracts have tests (T011-T014)
- [x] All REST endpoints have tests (T015-T018)
- [x] All entities have model tasks (T023-T026)
- [x] All quickstart scenarios have tests (T019-T022)
- [x] Tests come before implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks use different files
- [x] Each task specifies exact file path
- [x] No parallel tasks modify same file