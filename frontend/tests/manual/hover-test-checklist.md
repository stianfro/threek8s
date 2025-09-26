# Manual Hover Test Checklist

## Prerequisites
- [ ] Application running with `npm run dev`
- [ ] Connected to a Kubernetes cluster
- [ ] Browser developer console open for monitoring

## Pod Hover Tests

### Small Cluster (<100 pods)
- [ ] Start with a cluster that has less than 100 pods
- [ ] Hover over individual pod spheres
- [ ] Verify tooltip appears within 300ms
- [ ] Check tooltip shows:
  - [ ] Pod name
  - [ ] Namespace
  - [ ] Status (Running/Pending/Failed)
  - [ ] Node assignment
  - [ ] Container information
  - [ ] IP address (if available)
- [ ] Move cursor away from pod
- [ ] Verify tooltip disappears immediately
- [ ] Test hovering over pods in different states:
  - [ ] Running pods (green)
  - [ ] Pending pods (yellow)
  - [ ] Failed pods (red)

### Large Cluster (>100 pods)
- [ ] Scale cluster to have 100+ pods (instanced rendering activates)
- [ ] Hover over instanced pod representations
- [ ] Verify tooltip still works for each individual pod
- [ ] Check that instance ID is correctly mapped to pod data
- [ ] Verify performance remains smooth (no lag or jank)
- [ ] Test rapid hovering across many pods
- [ ] Confirm no memory leaks in console

## Node Hover Tests

### Basic Node Hovering
- [ ] Hover over node boxes
- [ ] Verify tooltip appears with node information:
  - [ ] Node name
  - [ ] Status (Ready/NotReady)
  - [ ] Role (master/worker)
  - [ ] Kubernetes version
  - [ ] CPU capacity
  - [ ] Memory capacity
- [ ] Test all nodes in cluster
- [ ] Verify tooltip positioning is consistent

### Pod vs Node Priority
- [ ] Position cursor over area where pod and node overlap
- [ ] Verify pod takes hover priority
- [ ] Move cursor to node area without pods
- [ ] Verify node tooltip appears
- [ ] Test edge cases near node boundaries

## Performance Tests

### FPS Monitoring
- [ ] Open browser Performance tab
- [ ] Start recording
- [ ] Move mouse rapidly across visualization
- [ ] Stop recording after 10 seconds
- [ ] Verify:
  - [ ] FPS stays at or near 60
  - [ ] No long tasks >50ms
  - [ ] Scripting time <30% of frame time

### Memory Tests
- [ ] Take initial heap snapshot
- [ ] Hover over 50+ objects
- [ ] Take second heap snapshot
- [ ] Compare snapshots
- [ ] Verify no significant memory growth
- [ ] Check for detached DOM nodes

## Edge Cases

### Viewport Boundaries
- [ ] Hover over objects near screen edges:
  - [ ] Top edge
  - [ ] Bottom edge
  - [ ] Left edge
  - [ ] Right edge
- [ ] Verify tooltip stays within viewport
- [ ] Check tooltip flips position when needed

### Window Resizing
- [ ] Hover over an object
- [ ] Resize browser window
- [ ] Verify tooltip repositions correctly
- [ ] Check raycasting still works after resize

### Rapid Interactions
- [ ] Quickly move between multiple pods
- [ ] Verify no tooltip flickering
- [ ] Check correct data shown for each pod
- [ ] Test switching between pods and nodes rapidly

### Special States
- [ ] Test hovering during camera animations
- [ ] Hover while zooming in/out
- [ ] Hover while rotating view
- [ ] Test with pods in various states:
  - [ ] CrashLoopBackOff
  - [ ] Terminating
  - [ ] Init

## Regression Tests

### Previous Issues
- [ ] Verify pod hovering works (was broken)
- [ ] Check instanced pod hovering (was missing)
- [ ] Confirm no duplicate event listeners
- [ ] Ensure single raycaster instance

## Console Checks
- [ ] No errors in console during hovering
- [ ] No warnings about performance
- [ ] No failed network requests
- [ ] No WebSocket disconnections

## Sign-off
- [ ] All pod hover tests pass
- [ ] All node hover tests pass
- [ ] Performance acceptable
- [ ] No regressions found
- [ ] Ready for production

---

**Test Date**: ___________
**Tester**: ___________
**Browser**: ___________
**Cluster Size**: ___________ nodes, ___________ pods
**Notes**:

___________________________________________
___________________________________________
___________________________________________