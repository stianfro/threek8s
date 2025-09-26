# Quickstart: Fix Hover Info for Pods and Nodes

## Prerequisites
- Running threek8s application with frontend and backend
- Connected to a Kubernetes cluster
- Browser developer tools for debugging

## Quick Verification Steps

### 1. Test Pod Hover (Small Cluster)
```bash
# Start the application
npm run dev

# Navigate to http://localhost:3000
# Move mouse over any pod visualization
# Expected: Tooltip appears showing pod information
```

### 2. Test Pod Hover (Large Cluster >100 pods)
```bash
# Connect to a large cluster or create test pods
kubectl apply -f tests/fixtures/many-pods.yaml

# Hover over pods in the visualization
# Expected: Tooltips work for all pods including instanced ones
```

### 3. Test Node Hover
```bash
# Move mouse over any node box in the visualization
# Expected: Tooltip appears showing node information including:
# - Node name and status
# - Resource capacity and usage
# - Pod count
# - System information
```

### 4. Test Hover Priority
```bash
# Position a pod near the edge of a node
# Slowly move cursor from node to pod
# Expected: Pod takes hover priority when overlapping
```

### 5. Test Hover Performance
```bash
# Open browser developer tools
# Go to Performance tab
# Start recording
# Move mouse rapidly across many objects
# Stop recording
# Expected: Maintain 60 FPS, no frame drops
```

## Integration Test Scenarios

### Scenario 1: Basic Pod Hover
1. Load application with test cluster
2. Hover over running pod
3. Verify tooltip shows:
   - Pod name
   - Namespace
   - Status: Running
   - Container count
   - Node assignment
4. Move cursor away
5. Verify tooltip disappears

### Scenario 2: Node Information Display
1. Load application with multi-node cluster
2. Hover over node box
3. Verify tooltip shows:
   - Node name
   - Status: Ready
   - CPU and Memory capacity
   - Current pod count
   - Kubernetes version
4. Verify information matches `kubectl describe node <name>`

### Scenario 3: Instance Rendering Hover
1. Create 150+ pods to trigger instancing
2. Hover over instanced pods
3. Verify each pod shows unique information
4. Verify instance ID is correctly mapped

### Scenario 4: Rapid Hover Switching
1. Move cursor quickly between multiple objects
2. Verify no tooltip flickering
3. Verify correct data shown for each object
4. Verify no memory leaks in console

### Scenario 5: Edge Cases
1. Hover over pod in Pending state - verify status shown correctly
2. Hover over node with no pods - verify "0 pods" shown
3. Hover at viewport edges - verify tooltip stays visible
4. Resize window while hovering - verify tooltip repositions

## Debugging Guide

### If Pod Hover Not Working:
```javascript
// Check in console:
visualizationManager.handleMouseMove // Should be defined
sceneManager.getRaycaster() // Should return Raycaster instance

// Verify raycasting enabled:
podObject.mesh.raycast // Should NOT be empty function
```

### If Node Hover Not Working:
```javascript
// Check node raycasting:
nodeObject.mesh.raycast // Should NOT be empty function

// Test hit detection:
const raycaster = sceneManager.getRaycaster();
const intersects = raycaster.intersectObjects(scene.children, true);
console.log(intersects); // Should include nodes
```

### If Instanced Pods Not Hovering:
```javascript
// Check instance manager:
podInstanceManager.getRaycasterIntersections(raycaster)
// Should return array with instanceId properties

// Verify instance count:
podInstanceManager.getInstanceCount() // Should match pod count
```

### If Tooltips Not Showing:
```javascript
// Check DOM element:
document.getElementById('tooltip') // Should exist

// Check display style:
tooltip.style.display // Should be 'block' when hovering

// Verify data provider:
tooltipDataProvider.getPodTooltipData(podId) // Should return data
```

## Performance Verification

### Chrome DevTools Performance Check:
1. Open Performance tab
2. Start profiling
3. Hover across 20+ objects
4. Stop profiling
5. Check:
   - FPS stays near 60
   - No long tasks > 50ms
   - Scripting time < 30% of frame

### Memory Check:
1. Open Memory tab
2. Take heap snapshot
3. Hover over 50 objects
4. Take another snapshot
5. Compare snapshots
6. Verify no significant memory growth

## Common Issues

### Issue: Tooltip appears in wrong position
**Solution**: Check mouse coordinate normalization in SceneManager

### Issue: Hovering node selects pod inside
**Solution**: Verify hover priority system is working (pods-first)

### Issue: Tooltip data is stale
**Solution**: Check WebSocket connection and state updates

### Issue: Performance degradation
**Solution**: Verify raycasting is not happening multiple times per frame

## Success Criteria Checklist
- [ ] Pod hover works for individual pod rendering (<100 pods)
- [ ] Pod hover works for instanced rendering (>100 pods)
- [ ] Node hover displays comprehensive information
- [ ] Tooltips appear within 300ms of hovering
- [ ] Tooltips disappear immediately on mouse leave
- [ ] No performance impact (maintains 60 FPS)
- [ ] Tooltips stay within viewport bounds
- [ ] Hover priority favors pods over nodes
- [ ] All tooltip data is accurate and current
- [ ] No console errors during hover interactions