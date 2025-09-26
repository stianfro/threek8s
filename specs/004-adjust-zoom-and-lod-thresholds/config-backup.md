# Configuration Backup - Original Values

## SceneManager.ts (frontend/src/scene/SceneManager.ts)
- Line 56: `maxDistance: 300` (OrbitControls max zoom distance)

## LODManager.ts (frontend/src/visualization/LODManager.ts)
- Lines 16-21: Distance thresholds
  ```typescript
  private readonly thresholds = {
    high: 150,    // Closer than 150 units
    medium: 300,  // 150-300 units
    low: 500,     // 300-500 units
    minimal: Infinity // Beyond 500 units
  };
  ```

## VisualizationManager.ts (frontend/src/visualization/VisualizationManager.ts)
- Line 291: `return { width: width * 0.8, height: height * 0.8 };` (80% visible area)
- Line 454: `const optimalDistance = (maxDimension * 1.2) / (2 * Math.tan(fov / 2));` (1.2 multiplier)
- Lines 314-334: Height ranges for cluster sizes
  ```typescript
  if (nodeCount <= 10) {
    minNodeSize = 15;
    maxNodeSize = 40;
    spacingFactor = 0.20;
  } else if (nodeCount <= 50) {
    minNodeSize = 8;
    maxNodeSize = 25;
    spacingFactor = 0.15;
  } else if (nodeCount <= 200) {
    minNodeSize = 4;
    maxNodeSize = 15;
    spacingFactor = 0.10;
  } else {
    minNodeSize = 2;
    maxNodeSize = 8;
    spacingFactor = 0.05;
  }
  ```

## Rollback Instructions
To revert changes, restore the above values in their respective files.