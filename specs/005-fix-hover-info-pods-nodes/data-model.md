# Data Model: Fix Hover Info for Pods and Nodes

## Entities

### HoverState
Manages the current hover state and interaction context.

**Fields:**
- `isHovering: boolean` - Whether user is currently hovering over an object
- `hoveredObject: THREE.Object3D | null` - The Three.js object being hovered
- `hoveredType: 'pod' | 'node' | null` - Type of Kubernetes object
- `hoveredData: PodTooltipData | NodeTooltipData | null` - Data for tooltip display
- `mousePosition: { x: number, y: number }` - Current mouse position for tooltip placement

**Validation:**
- hoveredObject must be a valid Three.js mesh or instance
- hoveredType must match the actual object type
- mousePosition must be within viewport bounds

**State Transitions:**
- `idle` → `hovering`: When mouse enters a hoverable object
- `hovering` → `idle`: When mouse leaves all objects
- `hovering` → `hovering`: When switching between objects

### PodTooltipData
Data structure for pod hover information display.

**Fields:**
- `name: string` - Pod name
- `namespace: string` - Kubernetes namespace
- `status: string` - Pod phase (Running, Pending, Failed, etc.)
- `containerCount: number` - Number of containers
- `nodeName: string` - Assigned node
- `age: string` - Human-readable age (e.g., "2 hours ago")
- `createdAt: Date` - Creation timestamp
- `ready: string` - Ready container status (e.g., "2/2")
- `restarts: number` - Total container restarts

**Validation:**
- name and namespace must be non-empty strings
- status must be a valid Kubernetes pod phase
- containerCount must be >= 0
- age must be formatted as relative time

**Relationships:**
- Derived from Pod entity in Kubernetes state
- Associated with PodObject or PodInstance in visualization

### NodeTooltipData
Data structure for node hover information display.

**Fields:**
- `name: string` - Node name
- `status: string` - Node condition (Ready, NotReady, etc.)
- `capacity: { cpu: string, memory: string }` - Total resources
- `allocatable: { cpu: string, memory: string }` - Available resources
- `podCount: number` - Number of pods on node
- `os: string` - Operating system
- `kernelVersion: string` - Kernel version
- `kubeletVersion: string` - Kubernetes version
- `containerRuntime: string` - Container runtime (e.g., "containerd://1.6.0")
- `age: string` - Human-readable age

**Validation:**
- name must be non-empty string
- status must be a valid node condition
- podCount must be >= 0
- resource values must be parseable Kubernetes quantities

**Relationships:**
- Derived from Node entity in Kubernetes state
- Associated with NodeObject in visualization

### TooltipConfig
Configuration for tooltip display behavior.

**Fields:**
- `delay: number` - Milliseconds before showing tooltip (default: 300)
- `offset: { x: number, y: number }` - Pixel offset from cursor
- `fadeInDuration: number` - Animation duration in ms
- `fadeOutDuration: number` - Animation duration in ms
- `maxWidth: number` - Maximum tooltip width in pixels
- `followCursor: boolean` - Whether tooltip follows mouse movement

**Validation:**
- delay must be >= 0
- offset values must be reasonable (< 100px)
- durations must be >= 0
- maxWidth must be > 0

### RaycastResult
Result of Three.js raycasting for hover detection.

**Fields:**
- `intersections: THREE.Intersection[]` - Raw Three.js intersections
- `primaryTarget: THREE.Object3D | null` - Highest priority hoverable object
- `targetType: 'pod' | 'node' | null` - Type of primary target
- `instanceId?: number` - Instance ID for instanced meshes
- `distance: number` - Distance from camera to target

**Validation:**
- primaryTarget must be in intersections array
- targetType must match object userData
- instanceId required for instanced meshes
- distance must be > 0

**State Transitions:**
- Updated every mousemove event
- Filtered by hover priority rules

## Relationships

### Object Hierarchy
```
Scene
├── NodeObject (hoverable)
│   ├── mesh (raycasting enabled)
│   ├── edges (raycasting disabled)
│   └── outline (raycasting disabled)
└── PodObject/PodInstance (hoverable)
    └── mesh (raycasting enabled)
```

### Data Flow
```
Mouse Event → Raycaster → RaycastResult → HoverState → TooltipData → DOM Update
```

### Priority Rules
1. Pods have hover priority over nodes
2. Closer objects have priority over farther ones
3. Smaller objects have priority when overlapping

## Event Sequences

### Enter Hover
1. mousemove event triggered
2. Raycaster performs intersection test
3. RaycastResult evaluated for hoverable objects
4. HoverState updated with new object
5. TooltipData fetched from state
6. Tooltip DOM element shown and positioned

### Exit Hover
1. mousemove to empty space or non-hoverable object
2. Raycaster finds no valid intersections
3. HoverState cleared
4. Tooltip DOM element hidden

### Switch Hover
1. mousemove from one object to another
2. Raycaster finds new primary target
3. HoverState updated with new object
4. TooltipData refreshed
5. Tooltip content and position updated

## Performance Considerations

### Caching Strategy
- Cache tooltip data for current frame
- Invalidate on WebSocket state updates
- Reuse DOM elements (no recreation)

### Throttling
- Raycasting performed every frame (60 FPS max)
- Tooltip updates only on hover change
- DOM positioning updates throttled to animation frames

### Memory Management
- Single Raycaster instance reused
- Tooltip data references existing state (no duplication)
- Intersection array cleared and reused