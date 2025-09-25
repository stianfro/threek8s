# Viewport Dynamic Scaling Fix - Implementation Plan

## Problem Analysis
The current implementation has nodes clustered too closely together, not utilizing available viewport space. The root causes are:

1. **Fixed viewport dimensions**: Lines 159-160 in VisualizationManager use hardcoded values (80x45) instead of actual viewport size
2. **Aggressive scaling**: Nodes are scaled down too much when trying to fit in the fixed viewport
3. **No viewport awareness**: Layout doesn't respond to actual window dimensions or camera frustum

## Solution Design

### Phase 1: Calculate Visible Viewport Area
- Use camera frustum and distance to calculate actual visible area
- Account for camera FOV, aspect ratio, and current zoom level
- Dynamically adjust based on window resize events

### Phase 2: Implement Adaptive Node Layout
- Calculate optimal node size based on:
  - Number of nodes
  - Available viewport space
  - Minimum/maximum size constraints
- Implement dynamic spacing that:
  - Maintains minimum separation between nodes
  - Expands to fill available space
  - Preserves aspect ratio for rectangular layouts

### Phase 3: Camera-Aware Positioning
- Adjust node positions based on camera distance
- Implement level-of-detail (LOD) for large clusters
- Ensure smooth transitions during zoom/pan operations

## Technical Implementation

### Key Changes to VisualizationManager.ts

1. **Add viewport calculation method**:
```typescript
private calculateVisibleArea(): { width: number; height: number } {
  const camera = this.sceneManager.getCamera();
  const distance = camera.position.y; // Top-down view
  const vFov = camera.fov * Math.PI / 180;
  const height = 2 * Math.tan(vFov / 2) * distance;
  const width = height * camera.aspect;
  return { width, height };
}
```

2. **Update calculateNodePosition method**:
- Remove fixed maxViewportWidth/Height
- Use calculateVisibleArea() for dynamic bounds
- Implement better spacing algorithm

3. **Add window resize handler**:
- Trigger relayout on resize
- Smooth animation for position changes

4. **Improve node scaling**:
- Set minimum node size (e.g., 10 units)
- Set maximum node size (e.g., 40 units)
- Scale based on viewport and node count

## Implementation Steps

1. **Refactor calculateNodePosition**:
   - Remove hardcoded viewport dimensions
   - Use camera frustum calculations
   - Implement adaptive spacing

2. **Add viewport awareness**:
   - Create calculateVisibleArea method
   - Hook into resize events
   - Update layout on camera changes

3. **Improve scaling logic**:
   - Better min/max constraints
   - Smooth scaling transitions
   - Maintain visual hierarchy

4. **Test scenarios**:
   - 1-5 nodes (should fill space)
   - 10-20 nodes (optimal layout)
   - 50+ nodes (compact but visible)
   - Window resize behavior
   - Zoom in/out behavior

## Success Criteria
- Nodes utilize at least 70% of visible viewport
- Minimum spacing of 5% node width maintained
- Smooth animations during layout changes
- Responsive to window resize
- Maintains performance with 100+ nodes