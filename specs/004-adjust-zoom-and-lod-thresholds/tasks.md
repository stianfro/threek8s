# Tasks: Adjust Initial Zoom and LOD Thresholds

**Input**: Design documents from `/specs/004-adjust-zoom-and-lod-thresholds/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Extract: Three.js, TypeScript, web architecture
2. Load design documents:
   → data-model.md: CameraConfiguration, LODConfiguration entities
   → contracts/viewport-config.yaml: viewport config endpoints
   → research.md: Technical decisions on zoom and LOD
3. Generate tasks by category:
   → Setup: Backup current values
   → Tests: Viewport and LOD validation tests
   → Core: Update configurations in 3 files
   → Integration: Verify with different cluster sizes
   → Polish: Performance validation, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T015)
6. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: `backend/src/`, `frontend/src/`
- Configuration changes primarily in frontend visualization code

## Phase 3.1: Setup
- [x] T001 Create backup of current configuration values in frontend/src/scene/SceneManager.ts and frontend/src/visualization/LODManager.ts
- [x] T002 [P] Document current performance baseline (FPS, load time) with test clusters

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [x] T003 [P] Test viewport fill ratio calculation in frontend/tests/viewport.test.ts - verify nodes fill 80-90% of viewport
- [x] T004 [P] Test LOD threshold distances in frontend/tests/lod.test.ts - verify pod visibility at 250-450 unit distances
- [x] T005 [P] Test camera distance calculations in frontend/tests/camera.test.ts - verify optimal distance for different cluster sizes
- [x] T006 [P] Create performance benchmark test in frontend/tests/performance.test.ts - ensure 60fps maintained

## Phase 3.3: Core Implementation (ONLY after tests are failing)
- [x] T007 Update LOD thresholds in frontend/src/visualization/LODManager.ts (lines 16-21): high=250, medium=450, low=750
- [x] T008 Update camera max distance in frontend/src/scene/SceneManager.ts (line 56): maxDistance=500
- [x] T009 Modify viewport calculation in frontend/src/visualization/VisualizationManager.ts (line 291): maintain 80% visible area
- [x] T010 Adjust camera distance multiplier in frontend/src/visualization/VisualizationManager.ts (line 454): change from 1.2 to 1.1
- [x] T011 Update height ranges for different cluster sizes in frontend/src/visualization/VisualizationManager.ts (lines 314-334)

## Phase 3.4: Integration
- [x] T012 Test with single node cluster - verify fills 80-90% of viewport
- [x] T013 Test with 10 node cluster - verify appropriate sizing and spacing
- [x] T014 Test with 50+ node cluster - verify performance and visibility
- [x] T015 Test responsive behavior - verify adjustments work on window resize

## Phase 3.5: Polish
- [x] T016 [P] Verify performance metrics meet targets (<100ms load impact, 60fps)
- [x] T017 [P] Update API documentation if viewport config endpoints are implemented
- [x] T018 Run quickstart validation checklist from quickstart.md
- [x] T019 Create rollback documentation with original values

## Dependencies
- Tests (T003-T006) before implementation (T007-T011)
- T007 (LOD) and T008 (camera) can be done in parallel [P]
- T009-T011 depend on T007-T008
- Integration tests (T012-T015) after implementation
- Polish tasks after integration

## Parallel Example
```
# Launch T003-T006 together (test creation):
Task: "Test viewport fill ratio calculation in frontend/tests/viewport.test.ts"
Task: "Test LOD threshold distances in frontend/tests/lod.test.ts"
Task: "Test camera distance calculations in frontend/tests/camera.test.ts"
Task: "Create performance benchmark test in frontend/tests/performance.test.ts"

# After tests are written and failing, T007 and T008 can run in parallel:
Task: "Update LOD thresholds in frontend/src/visualization/LODManager.ts"
Task: "Update camera max distance in frontend/src/scene/SceneManager.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each configuration change
- Keep original values documented for easy rollback
- This is primarily a configuration adjustment, not architectural change

## Validation Checklist
*GATE: Verify before marking complete*

- [x] All viewport fill tests passing (80-90% fill)
- [x] LOD thresholds correctly adjusted (1.5-2x visibility)
- [x] Performance maintained at 60fps
- [x] Works with clusters of 1-100+ nodes
- [x] Responsive to viewport resizing
- [x] Original values documented for rollback