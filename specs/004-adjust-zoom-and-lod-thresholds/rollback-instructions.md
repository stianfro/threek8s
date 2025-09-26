# Rollback Instructions

If you need to revert the zoom and LOD threshold changes, follow these steps:

## Files to Modify:

### 1. frontend/src/visualization/LODManager.ts
**Lines 16-21**, change back to:
```typescript
private readonly thresholds = {
  high: 150,    // Closer than 150 units
  medium: 300,  // 150-300 units
  low: 500,     // 300-500 units
  minimal: Infinity // Beyond 500 units
};
```

### 2. frontend/src/scene/SceneManager.ts
**Line 56**, change back to:
```typescript
controls.maxDistance = 300; // Allow further zoom out for large clusters
```

### 3. frontend/src/visualization/VisualizationManager.ts
**Line 454**, change back to:
```typescript
const optimalDistance = (maxDimension * 1.2) / (2 * Math.tan(fov / 2));
```

## Quick Rollback Commands:
```bash
# From the repository root:
git diff frontend/src/visualization/LODManager.ts
git diff frontend/src/scene/SceneManager.ts
git diff frontend/src/visualization/VisualizationManager.ts

# To revert all changes:
git checkout -- frontend/src/visualization/LODManager.ts
git checkout -- frontend/src/scene/SceneManager.ts
git checkout -- frontend/src/visualization/VisualizationManager.ts
```

## Verification After Rollback:
1. Restart the development server
2. Clear browser cache
3. Verify nodes occupy ~33% of viewport (original behavior)
4. Verify pods only visible at close zoom (< 150 units)
5. Check performance remains stable