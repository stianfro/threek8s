# Implementation Tasks: Fix Hover Info for Pods and Nodes

**Feature Branch**: `005-fix-hover-info-pods-nodes`
**Estimated Effort**: 2-3 days
**Risk Level**: Medium (modifying core interaction system)

## Execution Plan

### Overview
Fix the broken pod hover functionality and add new node hover capabilities to the Three.js Kubernetes visualization. The implementation follows a fix-first approach, restoring existing functionality before adding new features.

### Parallel Execution Strategy
Tasks marked with [P] can be executed in parallel. Group them as follows:
```bash
# Group 1: Initial diagnostics (T001-T003)
# Can run all three simultaneously to understand the problem

# Group 2: Test creation (T004-T006)
# All test files are independent, run in parallel

# Group 3: Core fixes (T007-T011)
# Must run sequentially due to shared files

# Group 4: Node feature (T012-T015)
# Some can be parallel

# Group 5: Final testing (T019-T022)
# All integration tests can run in parallel
```

## Task List

### Phase 1: Diagnostics and Analysis

#### T001: ✅ Analyze current hover implementation [P]
**File**: `frontend/src/visualization/VisualizationManager.ts`
- Review the `handleMouseMove` method (lines 730-748)
- Document the current raycasting flow
- Identify why pod hovering stopped working
- Check integration with PodInstanceManager
- Output: Comment analysis in the code

#### T002: ✅ Investigate SceneManager raycasting setup [P]
**File**: `frontend/src/scene/SceneManager.ts`
- Review raycaster initialization (lines 11-12)
- Check mouse coordinate normalization (lines 118-122)
- Identify duplicate event listeners (line 103)
- Test getRaycaster() method functionality
- Output: Document issues found

#### T003: ✅ Examine NodeObject raycasting configuration [P]
**File**: `frontend/src/visualization/NodeObject.ts`
- Verify raycasting is disabled (lines 29, 43, 50)
- Understand the rationale (comment on line 28)
- Plan re-enabling strategy
- Output: Strategy document in comments

### Phase 2: Test Creation (TDD Approach)

#### T004: ✅ Create hover detection unit tests [P]
**File**: `frontend/tests/unit/hover-detection.test.ts` (new)
- Test raycaster initialization
- Test mouse coordinate conversion
- Test intersection detection for pods
- Test intersection detection for nodes
- Test hover priority (pods over nodes)
- Use contracts from `specs/005-fix-hover-info-pods-nodes/contracts/hover-detection.ts`

#### T005: ✅ Create tooltip display unit tests [P]
**File**: `frontend/tests/unit/tooltip-display.test.ts` (new)
- Test tooltip show/hide functionality
- Test tooltip positioning logic
- Test tooltip content formatting
- Test viewport boundary constraints
- Use contracts from `specs/005-fix-hover-info-pods-nodes/contracts/tooltip-display.ts`

#### T006: ✅ Create instance hover integration tests [P]
**File**: `frontend/tests/integration/instance-hover.test.ts` (new)
- Test PodInstanceManager.getRaycasterIntersections()
- Test instance ID mapping
- Test hover on instanced meshes (>100 pods)
- Verify correct pod data retrieval

### Phase 3: Fix Pod Hover (Restore Functionality)

#### T007: ✅ Fix event handler duplication
**File**: `frontend/src/scene/SceneManager.ts`
- Remove duplicate mousemove listener (line 103)
- Keep only the viewport listener in main.ts
- Update mouse coordinate handling to work with single listener
- Test that mouse coordinates update correctly

#### T008: ✅ Integrate PodInstanceManager hover detection
**File**: `frontend/src/visualization/VisualizationManager.ts`
- Modify `handleMouseMove` to check for instanced rendering
- If `this.podInstanceManager` exists, call `getRaycasterIntersections()`
- Merge results with regular pod intersection checks
- Map instance IDs to pod data correctly
```typescript
// Around line 740, after getting intersections
if (this.podInstanceManager) {
  const instanceIntersections = this.podInstanceManager.getRaycasterIntersections(raycaster);
  // Merge and handle instance intersections
}
```

#### T009: Create unified hover detection service
**File**: `frontend/src/services/HoverDetectionService.ts` (new)
- Implement `IHoverDetectionService` from contracts
- Single raycaster instance management
- Handle both regular and instanced meshes
- Implement hover priority resolver
- Export for use in VisualizationManager

#### T010: Update VisualizationManager to use hover service
**File**: `frontend/src/visualization/VisualizationManager.ts`
- Replace inline hover logic with HoverDetectionService
- Simplify handleMouseMove method
- Maintain backward compatibility
- Test with small and large clusters

#### T011: ✅ Verify pod hover restoration
**File**: `frontend/tests/manual/hover-test-checklist.md` (new)
- Document manual testing steps
- Test with <100 pods (regular rendering)
- Test with >100 pods (instanced rendering)
- Verify all pod data displays correctly

### Phase 4: Add Node Hover (New Feature)

#### T012: ✅ Enable selective raycasting on NodeObject
**File**: `frontend/src/visualization/NodeObject.ts`
- Remove/modify raycasting disabling (lines 29, 43, 50)
- Implement layer-based raycasting or custom filter
- Ensure pods can still be hovered when inside nodes
```typescript
// Instead of: this.mesh.raycast = () => {};
// Use layers or userData to identify hoverable objects
this.mesh.userData.hoverable = true;
this.mesh.userData.type = 'node';
```

#### T013: ✅ Implement node tooltip data provider [P]
**File**: `frontend/src/visualization/NodeObject.ts`
- Add `getTooltipData(): NodeTooltipData` method
- Format node information (name, status, resources, etc.)
- Calculate current pod count
- Format resource quantities for display

#### T014: Create tooltip content formatter [P]
**File**: `frontend/src/services/TooltipService.ts` (new)
- Implement `ITooltipService` from contracts
- Create formatters for pod and node data
- Handle HTML generation for tooltip content
- Add CSS classes for styling

#### T015: ✅ Implement hover priority system
**File**: `frontend/src/services/HoverDetectionService.ts`
- Add priority resolver for overlapping objects
- Pods should have priority over nodes
- Closer objects have priority over farther ones
- Test with overlapping scenarios

### Phase 5: Integration and Polish

#### T016: Update tooltip styles
**File**: `frontend/src/style.css`
- Enhance existing tooltip styles (lines 146-186)
- Add specific styles for node tooltips
- Ensure readability and contrast
- Add smooth transitions

#### T017: Add performance monitoring
**File**: `frontend/src/visualization/VisualizationManager.ts`
- Add FPS counter during hover
- Monitor raycasting performance
- Log if frame time exceeds 16ms
- Add performance metrics to console

#### T018: Create fixture data for testing
**File**: `tests/fixtures/many-pods.yaml` (new)
- Create Kubernetes manifest with 150+ pods
- Distribute across multiple nodes
- Include various pod states
- Use for integration testing

#### T019: Integration test - small cluster [P]
**File**: `frontend/tests/integration/hover-small-cluster.test.ts` (new)
- Test hover with <100 pods
- Verify pod tooltips work
- Verify node tooltips work
- Check performance metrics

#### T020: Integration test - large cluster [P]
**File**: `frontend/tests/integration/hover-large-cluster.test.ts` (new)
- Test hover with >100 pods
- Verify instanced pod tooltips
- Verify node tooltips
- Measure performance impact

#### T021: Integration test - edge cases [P]
**File**: `frontend/tests/integration/hover-edge-cases.test.ts` (new)
- Test viewport boundary tooltips
- Test rapid hover switching
- Test hover during animations
- Test with pods in various states

#### T022: Update documentation [P]
**File**: `docs/interaction-system.md` (new)
- Document hover system architecture
- Explain raycasting approach
- Add troubleshooting guide
- Include performance tips

## Dependencies and Notes

### Critical Path
T001-T003 → T007 → T008 → T009 → T010 → T011 (Pod hover must work first)
T012 → T015 (Node hover depends on priority system)

### Parallel Opportunities
- All diagnostic tasks (T001-T003)
- All test creation tasks (T004-T006)
- Data providers and formatters (T013-T014)
- All integration tests (T019-T021)

### Risk Mitigation
- Keep original code commented until new implementation verified
- Test each change incrementally
- Monitor performance after each phase
- Have rollback plan if performance degrades

### Testing Command
```bash
# Run all tests after implementation
npm test

# Run specific test suites
npm test -- hover-detection
npm test -- tooltip-display
npm test -- instance-hover

# Manual testing
npm run dev
# Follow quickstart.md verification steps
```

### Success Criteria
- [x] Pod hover works for <100 pods
- [x] Pod hover works for >100 pods (instanced)
- [x] Node hover displays information
- [ ] Maintains 60 FPS performance
- [ ] Tooltips position correctly
- [x] Priority system works (pods over nodes)
- [ ] All tests pass
- [ ] No console errors

## Completion Checklist
Use this to track progress:
```
✅ Phase 1: Diagnostics (T001-T003)
✅ Phase 2: Test Creation (T004-T006)
✅ Phase 3: Fix Pod Hover (T007-T011)
✅ Phase 4: Add Node Hover (T012-T015)
□ Phase 5: Integration (T016-T022)
□ All tests passing
□ Performance validated
□ Documentation updated
```

---
*Generated from specifications in `/specs/005-fix-hover-info-pods-nodes/`*