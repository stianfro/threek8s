# Research: Fix Hover Info for Pods and Nodes

## Executive Summary
The hover functionality is broken due to intentional raycasting disabling on nodes (to allow pod hovering) and missing integration with instanced pod rendering. The fix requires implementing proper hierarchical hit-testing that handles both nodes and pods correctly.

## Current Implementation Analysis

### Architecture Overview
- **Event Flow**: viewport mousemove → VisualizationManager.handleMouseMove → SceneManager.getRaycaster → Three.js intersection testing → tooltip display
- **Components Involved**: SceneManager, VisualizationManager, NodeObject, PodObject, PodInstanceManager
- **Tooltip System**: Functional HTML/CSS tooltip exists and works when triggered

### Critical Issues Identified

#### 1. Node Hover Completely Disabled
- **Location**: NodeObject.ts lines 29, 43, 50
- **Decision**: Raycasting was disabled on all node meshes
- **Rationale**: Allow pods inside nodes to be hovered without node interference
- **Alternatives considered**: None documented
- **Impact**: Nodes cannot be hovered or display tooltips at all

#### 2. Instanced Pod Hover Broken
- **Location**: VisualizationManager.ts handleMouseMove method
- **Decision**: Direct raycasting on pod objects only
- **Rationale**: Simple implementation for small clusters
- **Alternatives considered**: PodInstanceManager.getRaycasterIntersections() exists but unused
- **Impact**: Pods in clusters >100 (using instanced rendering) cannot be hovered

#### 3. Event Handler Duplication
- **Location**: SceneManager.ts line 103 and main.ts line 100
- **Decision**: Multiple mousemove listeners
- **Rationale**: Unknown - likely development artifact
- **Alternatives considered**: Single consolidated handler
- **Impact**: Potential performance overhead and confusion

## Technical Decisions

### Hover Detection Strategy
- **Decision**: Use Three.js Raycaster with layers or selective raycasting
- **Rationale**: Standard Three.js approach, already partially implemented
- **Alternatives considered**:
  - Custom hit-testing: Too complex, reinventing the wheel
  - CSS-based hover: Won't work with WebGL canvas
  - Separate invisible hit meshes: Additional memory overhead

### Hit Priority System
- **Decision**: Implement layered detection - check pods first, then nodes
- **Rationale**: Pods are smaller and more specific, should have hover priority
- **Alternatives considered**:
  - Z-order based: Unreliable with 3D rotation
  - Size-based: Pods are always smaller, same result
  - Toggle mode: Poor UX, requires user action

### Instance Handling
- **Decision**: Integrate PodInstanceManager.getRaycasterIntersections()
- **Rationale**: Method already exists and handles instance ID mapping
- **Alternatives considered**:
  - Disable instancing: Major performance impact
  - GPU picking: Overly complex for this use case
  - Separate instance hover system: Code duplication

### Data Flow for Tooltips
- **Decision**: Unified tooltip data provider pattern
- **Rationale**: Consistent interface for both nodes and pods
- **Alternatives considered**:
  - Separate tooltip systems: Code duplication
  - Direct property access: Tight coupling
  - Event-based: Unnecessary complexity

## Performance Considerations

### Raycasting Optimization
- **Decision**: Single raycaster instance, updated per frame
- **Rationale**: Reuse reduces garbage collection
- **Alternatives considered**:
  - Multiple raycasters: Memory overhead
  - Throttled raycasting: Can feel laggy
  - Spatial indexing: Overkill for current scale

### Tooltip Update Frequency
- **Decision**: Immediate update on hover change
- **Rationale**: Responsive feel, modern UX expectation
- **Alternatives considered**:
  - Debounced updates: Can feel sluggish
  - Animated transitions: Added complexity for minimal benefit

## Browser Compatibility
- **Decision**: Use standard pointer events and DOM manipulation
- **Rationale**: Wide browser support, already working
- **Alternatives considered**:
  - Touch events: Future enhancement, not in scope
  - WebGL-rendered tooltips: Harder to style and position

## Integration Points

### Kubernetes Data
- **Decision**: Reuse existing data structures from state management
- **Rationale**: Data already fetched and maintained
- **Alternatives considered**:
  - Separate tooltip data fetch: Unnecessary API calls
  - Cached tooltip data: Synchronization complexity

### WebSocket Updates
- **Decision**: Tooltips use latest data from state, no special handling
- **Rationale**: Automatic updates via reactive state
- **Alternatives considered**:
  - Subscribe to specific object updates: Over-engineering
  - Static tooltip data: Would become stale

## Implementation Approach

### Phase 1: Fix Node Raycasting
- Enable raycasting on node meshes
- Implement hit priority (pods over nodes)
- Test with various cluster sizes

### Phase 2: Fix Instance Hovering
- Integrate PodInstanceManager hover detection
- Unify hover logic for regular and instanced pods
- Verify performance with large clusters

### Phase 3: Add Node Tooltips
- Implement getTooltipData() for NodeObject
- Display node-specific information
- Ensure visual consistency with pod tooltips

### Testing Strategy
- **Decision**: Unit tests for hit detection, integration tests for tooltip display
- **Rationale**: Balance coverage with maintainability
- **Alternatives considered**:
  - E2E tests only: Too slow for development
  - Manual testing only: No regression protection

## Conclusion
All technical unknowns have been resolved through codebase analysis. The implementation path is clear: fix the raycasting issues, integrate instance handling, and ensure consistent tooltip behavior across all object types.