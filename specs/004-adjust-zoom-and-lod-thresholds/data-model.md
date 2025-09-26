# Data Model: Adjust Initial Zoom and LOD Thresholds

## Overview
Configuration and state management for camera zoom and LOD threshold adjustments.

## Entities

### 1. CameraConfiguration
**Purpose**: Manages camera positioning and zoom parameters

```typescript
interface CameraConfiguration {
  // Initial camera setup
  initialPosition: {
    x: number;        // Default: 0
    y: number;        // Height above scene (default: 100)
    z: number;        // Default: 0.001 (avoid gimbal lock)
  };

  // Zoom constraints
  minDistance: number;  // Minimum zoom distance (default: 20)
  maxDistance: number;  // Maximum zoom distance (default: 300)

  // Viewport optimization
  viewportFillRatio: number;  // Target fill ratio (0.8-0.9)
  paddingMultiplier: number;  // Padding around content (1.1-1.2)

  // Adaptive height ranges by cluster size
  heightRanges: {
    small: { min: number; max: number; threshold: number };   // 1-10 nodes
    medium: { min: number; max: number; threshold: number };  // 11-50 nodes
    large: { min: number; max: number; threshold: number };   // 51+ nodes
  };
}
```

**Validation Rules**:
- `viewportFillRatio` must be between 0.7 and 0.95
- `minDistance` must be positive and less than `maxDistance`
- Height ranges must not overlap

### 2. LODConfiguration
**Purpose**: Defines Level of Detail thresholds and behaviors

```typescript
interface LODConfiguration {
  // Distance thresholds for detail levels
  thresholds: {
    high: number;     // Close view threshold
    medium: number;   // Medium distance threshold
    low: number;      // Far view threshold
    minimal: number;  // Very far (typically Infinity)
  };

  // Visibility rules
  visibility: {
    podsVisibleAt: DetailLevel[];  // Which levels show pods
    nodeDetailsAt: DetailLevel[];  // Which levels show node details
    animatePodsAt: DetailLevel[];  // Which levels animate pods
  };

  // Opacity settings per level
  opacity: {
    pods: Map<DetailLevel, number>;
    nodes: Map<DetailLevel, number>;
  };

  // Animation speed multipliers
  animationSpeed: Map<DetailLevel, number>;
}

enum DetailLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  MINIMAL = 'minimal'
}
```

**Validation Rules**:
- Thresholds must be in ascending order: high < medium < low
- Opacity values must be between 0 and 1
- Animation speed multipliers must be between 0 and 1

### 3. ViewportMetrics
**Purpose**: Tracks viewport and performance metrics

```typescript
interface ViewportMetrics {
  // Current viewport state
  dimensions: {
    width: number;
    height: number;
    aspectRatio: number;
  };

  // Cluster visualization metrics
  cluster: {
    nodeCount: number;
    podCount: number;
    boundingBox: {
      min: THREE.Vector3;
      max: THREE.Vector3;
      center: THREE.Vector3;
      size: THREE.Vector3;
    };
  };

  // Camera metrics
  camera: {
    distance: number;
    fov: number;
    visibleArea: {
      width: number;
      height: number;
    };
  };

  // Performance metrics
  performance: {
    fps: number;
    renderTime: number;
    lodLevel: DetailLevel;
    visibleObjects: number;
  };
}
```

**State Transitions**:
- Metrics update on camera movement
- Metrics update on window resize
- Metrics update on cluster state change

## Relationships

### CameraConfiguration → ViewportMetrics
- Camera config determines visible area calculations
- Height ranges affect camera distance based on cluster size

### LODConfiguration → ViewportMetrics
- LOD thresholds determine current detail level based on camera distance
- Detail level affects performance metrics (visible objects, FPS)

### ViewportMetrics → Rendering
- Visible area determines node layout scaling
- LOD level controls pod visibility and animation
- Performance metrics trigger optimization strategies

## State Management

### Initial State
```typescript
const defaultCameraConfig: CameraConfiguration = {
  initialPosition: { x: 0, y: 100, z: 0.001 },
  minDistance: 20,
  maxDistance: 500,  // Increased from 300
  viewportFillRatio: 0.85,  // Target 85% fill
  paddingMultiplier: 1.1,   // 10% padding
  heightRanges: {
    small: { min: 50, max: 150, threshold: 10 },
    medium: { min: 80, max: 300, threshold: 50 },
    large: { min: 100, max: 500, threshold: 51 }
  }
};

const defaultLODConfig: LODConfiguration = {
  thresholds: {
    high: 250,    // Increased from 150
    medium: 450,  // Increased from 300
    low: 750,     // Increased from 500
    minimal: Infinity
  },
  visibility: {
    podsVisibleAt: [DetailLevel.HIGH, DetailLevel.MEDIUM],
    nodeDetailsAt: [DetailLevel.HIGH, DetailLevel.MEDIUM, DetailLevel.LOW],
    animatePodsAt: [DetailLevel.HIGH]
  },
  opacity: new Map([
    [DetailLevel.HIGH, { pods: 0.95, nodes: 0.3 }],
    [DetailLevel.MEDIUM, { pods: 0.7, nodes: 0.3 }],
    [DetailLevel.LOW, { pods: 0.3, nodes: 0.5 }],
    [DetailLevel.MINIMAL, { pods: 0, nodes: 0.7 }]
  ]),
  animationSpeed: new Map([
    [DetailLevel.HIGH, 1.0],
    [DetailLevel.MEDIUM, 0.5],
    [DetailLevel.LOW, 0.1],
    [DetailLevel.MINIMAL, 0]
  ])
};
```

### State Updates
1. **On Cluster Load**: Calculate optimal camera position
2. **On Resize**: Recalculate viewport metrics and adjust camera
3. **On Zoom**: Update LOD level and visibility
4. **On Node Count Change**: Adjust height ranges and layout

## Persistence
Configuration values are compile-time constants, not user-persisted. Future enhancement could add user preferences for zoom and LOD settings.