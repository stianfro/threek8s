# Data Model: Kubernetes Cluster 3D Visualization

## Core Entities

### KubernetesNode
Represents a node in the Kubernetes cluster.

**Fields:**
- `name`: string - Unique node identifier
- `uid`: string - Kubernetes UID
- `status`: NodeStatus - Current node status
- `role`: string - Node role (master/worker)
- `capacity`: ResourceInfo - Node resource capacity
- `allocatable`: ResourceInfo - Available resources
- `conditions`: NodeCondition[] - Node health conditions
- `position`: Vector3 - 3D position in visualization
- `labels`: Map<string, string> - Kubernetes labels
- `creationTimestamp`: Date - When node was created

**States:**
- Ready: Node is healthy and accepting pods
- NotReady: Node is not accepting new pods
- Unknown: Node status cannot be determined

### Pod
Represents a Kubernetes pod.

**Fields:**
- `name`: string - Pod name
- `uid`: string - Kubernetes UID
- `namespace`: string - Kubernetes namespace
- `nodeName`: string - Host node name
- `status`: PodStatus - Current pod status
- `phase`: PodPhase - Pod lifecycle phase
- `containers`: ContainerInfo[] - Container details
- `position`: Vector3 - 3D position within node
- `labels`: Map<string, string> - Kubernetes labels
- `creationTimestamp`: Date - When pod was created
- `deletionTimestamp`: Date | null - Scheduled deletion

**States:**
- Pending: Pod accepted but not running
- Running: Pod bound and containers running
- Succeeded: All containers completed successfully
- Failed: All containers terminated with failure
- Unknown: Pod status cannot be determined

### Namespace
Represents a Kubernetes namespace.

**Fields:**
- `name`: string - Namespace name
- `uid`: string - Kubernetes UID
- `status`: NamespaceStatus - Active/Terminating
- `podCount`: number - Number of pods in namespace
- `labels`: Map<string, string> - Kubernetes labels

### ClusterState
Root entity maintaining overall cluster state.

**Fields:**
- `nodes`: Map<string, KubernetesNode> - All nodes by name
- `pods`: Map<string, Pod> - All pods by uid
- `namespaces`: Map<string, Namespace> - All namespaces
- `connectionStatus`: ConnectionStatus - Cluster connection state
- `lastUpdated`: Date - Last successful sync
- `metrics`: ClusterMetrics - Aggregate metrics

## Value Objects

### Vector3
3D coordinates for visualization positioning.

**Fields:**
- `x`: number - X coordinate
- `y`: number - Y coordinate
- `z`: number - Z coordinate

### ResourceInfo
Resource capacity/usage information.

**Fields:**
- `cpu`: string - CPU cores (e.g., "4000m")
- `memory`: string - Memory bytes (e.g., "8Gi")
- `pods`: string - Pod capacity (e.g., "110")
- `storage`: string - Ephemeral storage

### NodeCondition
Node health condition.

**Fields:**
- `type`: string - Condition type (Ready, MemoryPressure, etc.)
- `status`: string - True/False/Unknown
- `lastTransitionTime`: Date - When condition changed
- `reason`: string - Brief reason
- `message`: string - Human-readable message

### ContainerInfo
Container within a pod.

**Fields:**
- `name`: string - Container name
- `image`: string - Container image
- `state`: ContainerState - Current state
- `ready`: boolean - Container readiness

### PodPhase
Enumeration of pod lifecycle phases:
- `Pending`
- `Running`
- `Succeeded`
- `Failed`
- `Unknown`

### NodeStatus
Enumeration of node statuses:
- `Ready`
- `NotReady`
- `Unknown`

### ConnectionStatus
Cluster connection state:
- `Connected`
- `Connecting`
- `Disconnected`
- `Error`

### ClusterMetrics
Aggregate cluster metrics.

**Fields:**
- `totalNodes`: number - Total node count
- `readyNodes`: number - Ready node count
- `totalPods`: number - Total pod count
- `runningPods`: number - Running pod count
- `pendingPods`: number - Pending pod count
- `failedPods`: number - Failed pod count

## Relationships

### Node → Pod (1:N)
- A node contains zero or more pods
- Pods reference their host node via `nodeName`
- Relationship changes when pods are scheduled/rescheduled

### Namespace → Pod (1:N)
- A namespace contains zero or more pods
- Pods belong to exactly one namespace
- Immutable relationship (pods cannot change namespace)

### ClusterState → All Entities
- ClusterState aggregates all entities
- Maintains indices for fast lookups
- Handles entity lifecycle (add/update/delete)

## State Transitions

### Pod Lifecycle
```
[Created] → Pending → Running → [Succeeded|Failed]
                ↓         ↓
            [Deleted] [Deleted]
```

### Node Lifecycle
```
[Added] → Ready ←→ NotReady
            ↓         ↓
        [Removed] [Removed]
```

### Animation Triggers
- Pod Created: Fade-in animation at position
- Pod Deleted: Fade-out animation
- Pod Moved: Translate animation between nodes
- Node Added: Slide-in animation
- Node Removed: Slide-out animation

## Event Model

### WatchEvent
Generic Kubernetes watch event.

**Fields:**
- `type`: EventType - ADDED/MODIFIED/DELETED
- `object`: any - The Kubernetes object
- `timestamp`: Date - When event occurred

### EventType
Watch event types:
- `ADDED`: New resource created
- `MODIFIED`: Existing resource updated
- `DELETED`: Resource removed
- `ERROR`: Watch error occurred

## Validation Rules

### Node Validation
- Name must be non-empty and unique
- Status must be valid enum value
- Position must have valid coordinates
- Capacity values must be positive

### Pod Validation
- Name must be non-empty
- Namespace must exist
- If nodeName set, node must exist
- Phase must be valid enum value
- Container array cannot be empty

### Namespace Validation
- Name must be non-empty and unique
- Name must match Kubernetes DNS rules
- Status must be Active or Terminating

## Performance Considerations

### Indexing Strategy
- Primary index: By resource UID
- Secondary indices:
  - Pods by node name (fast node→pods lookup)
  - Pods by namespace (fast filtering)
  - Nodes by status (rendering optimization)

### Update Batching
- Collect watch events in 100ms windows
- Apply batch updates to reduce re-renders
- Maintain update queue for animations

### Memory Management
- Limit pod history to last 1000 deleted
- Prune old events after processing
- Use weak references for temporary data

## Data Flow

```
Kubernetes API → Watch Events → Event Processor → State Manager → 3D Renderer
                                      ↓                ↓              ↓
                                 Validation      Update Indices   Animations
```

## Schema Version
**Version**: 1.0.0
**Last Updated**: 2025-01-24

Changes to this schema require:
1. Migration strategy for existing state
2. Version compatibility checks
3. Update to API contracts