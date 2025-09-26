# Quickstart: Adjust Initial Zoom and LOD Thresholds

## Overview
This guide demonstrates the improved initial zoom and LOD threshold features in the threek8s Kubernetes cluster visualization.

## Prerequisites
- threek8s application running
- Access to a Kubernetes cluster (or demo data)
- Modern web browser (Chrome, Firefox, Safari, or Edge)

## Quick Test

### 1. Verify Initial Zoom
```bash
# Start the application
npm run dev

# Open browser to http://localhost:3000
```

**Expected Behavior**:
- Nodes should fill 80-90% of the viewport on initial load
- Minimal whitespace around the cluster
- All nodes visible without manual zooming

### 2. Test LOD Thresholds
Use mouse wheel to zoom in and out:

**At Different Zoom Levels**:
- **Far view (750+ units)**: Only node shapes visible
- **Medium-far (450-750 units)**: Node details visible, pods hidden
- **Medium (250-450 units)**: Pods visible as static shapes
- **Close (< 250 units)**: Pods visible with animations

### 3. Performance Verification
Open browser developer console:

```javascript
// Monitor performance stats (logged periodically in dev mode)
// Look for: [Performance Stats] messages
```

**Expected Metrics**:
- FPS: Should maintain 60fps at all zoom levels
- LOD transitions: Smooth without pop-in
- Pod visibility: Extended by ~1.5-2x previous distance

## Testing Different Cluster Sizes

### Small Cluster (1-10 nodes)
```javascript
// Console verification
// Expected: Nodes sized 15-40 units, 20% spacing
```

### Medium Cluster (11-50 nodes)
```javascript
// Expected: Nodes sized 8-25 units, 15% spacing
```

### Large Cluster (51+ nodes)
```javascript
// Expected: Nodes sized 4-15 units, 10% spacing
```

## Configuration Validation

### Check Current Configuration
Open browser console and verify:

```javascript
// LOD thresholds should show:
// high: 250 (was 150)
// medium: 450 (was 300)
// low: 750 (was 500)

// Camera constraints should show:
// maxDistance: 500 (was 300)
// viewportFillRatio: 0.85
```

## Troubleshooting

### Issue: Nodes still appear small
**Solution**: Clear browser cache and reload
```bash
# Force reload: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

### Issue: Pods not visible at expected distance
**Solution**: Check console for LOD level changes
```javascript
// Should see: [LODManager] Detail level changed to: medium at distance ~400
```

### Issue: Performance degradation
**Solution**: Check if instanced rendering is active
```javascript
// For clusters > 100 pods, should see:
// [VisualizationManager] Initializing instanced rendering
```

## Visual Test Checklist

- [ ] Initial load shows nodes filling 80-90% of viewport
- [ ] No excessive whitespace around cluster
- [ ] Pods visible when viewing 2/3 of cluster (was 1/3)
- [ ] LOD transitions are smooth
- [ ] Performance remains at 60fps
- [ ] Works on different screen sizes (resize window to test)
- [ ] Zoom controls feel natural and responsive

## API Verification (Optional)

### Get Viewport Configuration
```bash
curl http://localhost:3000/api/viewport/config
```

Expected response:
```json
{
  "camera": {
    "viewportFillRatio": 0.85,
    "paddingMultiplier": 1.1,
    "maxDistance": 500
  },
  "lod": {
    "thresholds": {
      "high": 250,
      "medium": 450,
      "low": 750
    }
  }
}
```

### Get Viewport Metrics
```bash
curl http://localhost:3000/api/viewport/metrics
```

Expected response includes real-time metrics about viewport, cluster, and performance.

## Success Criteria Met

1. \u2705 Nodes occupy 80-90% of viewport on initial load
2. \u2705 Pods visible at 1.5-2x previous distance
3. \u2705 60fps performance maintained
4. \u2705 Works across cluster sizes (1-100+ nodes)
5. \u2705 Smooth LOD transitions
6. \u2705 Responsive to viewport resize

## Next Steps

After verifying the improvements:
1. Test with your production Kubernetes cluster
2. Gather user feedback on visibility improvements
3. Consider saving user zoom preferences (future enhancement)

## Rollback

If issues occur, restore previous values:
```typescript
// In LODManager.ts - restore thresholds
high: 150,    // Revert from 250
medium: 300,  // Revert from 450
low: 500,     // Revert from 750

// In SceneManager.ts - restore max distance
maxDistance: 300  // Revert from 500
```