# Feature Specification: Fix Hover Info for Pods and Nodes

## Overview
The hover functionality for displaying pod information has stopped working after recent changes and needs to be fixed. Additionally, we need to add hover functionality for node boxes to display node information.

## Problem Statement
After recent updates to the application, the hover tooltips that previously displayed pod information are no longer functioning. Users cannot see pod details when hovering over pod representations in the 3D visualization. Furthermore, there is no hover functionality for nodes, which limits the user's ability to quickly inspect node information.

## User Stories
1. **As a user**, I want to see pod information when hovering over pods so that I can quickly inspect pod details without clicking.
2. **As a user**, I want to see node information when hovering over node boxes so that I can understand node specifications and status at a glance.
3. **As a developer**, I want consistent hover behavior across different Kubernetes object types so that the UI feels predictable and maintainable.

## Functional Requirements

### FR1: Restore Pod Hover Functionality
- The system SHALL display pod information tooltip when hovering over pod representations
- The tooltip SHALL show:
  - Pod name
  - Namespace
  - Status (Running, Pending, Failed, etc.)
  - Container count
  - Node assignment
  - Age/creation time
- The tooltip SHALL appear after a short delay (300-500ms) to avoid flickering
- The tooltip SHALL disappear when the cursor moves away from the pod

### FR2: Add Node Hover Functionality
- The system SHALL display node information tooltip when hovering over node boxes
- The tooltip SHALL show:
  - Node name
  - Status (Ready, NotReady, etc.)
  - Capacity (CPU, Memory)
  - Allocatable resources
  - Pod count
  - Operating System
  - Kubernetes version
- The tooltip SHALL follow the same timing and behavior patterns as pod tooltips

### FR3: Tooltip Positioning
- Tooltips SHALL be positioned near the cursor but not obscure the hovered object
- Tooltips SHALL remain within viewport bounds (no clipping at edges)
- Tooltips SHALL be readable with appropriate contrast against the 3D scene

## Non-Functional Requirements

### NFR1: Performance
- Hover detection SHALL not impact frame rate (maintain 60 FPS)
- Tooltip rendering SHALL be efficient and not cause UI jank

### NFR2: Consistency
- Tooltip design SHALL be consistent across pod and node hover states
- Animation timing SHALL be uniform for all tooltip interactions

### NFR3: Accessibility
- Tooltips SHALL be keyboard accessible (focus/tab navigation)
- Tooltip text SHALL be screen reader compatible

## Technical Constraints
- Must work with the existing Three.js visualization framework
- Must integrate with current Kubernetes API client
- Should utilize existing WebSocket connections for real-time updates
- Must be compatible with the recent changes that broke the functionality

## Success Criteria
1. Pod hover tooltips work consistently across all pod representations
2. Node hover tooltips display comprehensive node information
3. No performance degradation when hovering over objects
4. Tooltips are visually consistent and readable
5. The fix addresses the root cause of the recent regression

## Dependencies
- Three.js raycasting for hover detection
- Kubernetes client for fetching object details
- Existing tooltip/overlay component system

## Acceptance Criteria
- [ ] Pod hover shows all required information fields
- [ ] Node hover shows all required information fields
- [ ] Tooltips appear/disappear with appropriate timing
- [ ] Tooltips position correctly without viewport clipping
- [ ] Performance remains at 60 FPS during hover interactions
- [ ] Regression that broke pod hovering is identified and fixed
- [ ] Unit tests cover hover detection logic
- [ ] Integration tests verify tooltip data accuracy