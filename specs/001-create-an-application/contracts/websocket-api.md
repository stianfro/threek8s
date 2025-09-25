# WebSocket API Contract

## Connection Endpoint
`ws://localhost:3001/ws`

## Connection Flow

### Client → Server: Initial Connection
```javascript
// Client connects with optional query parameters
ws = new WebSocket('ws://localhost:3001/ws?namespaces=default,kube-system');
```

### Server → Client: Connection Acknowledgment
```json
{
  "type": "connection",
  "status": "connected",
  "timestamp": "2025-01-24T10:00:00Z",
  "cluster": {
    "name": "my-cluster",
    "version": "v1.29.0"
  }
}
```

## Message Types

### 1. Initial State
Sent immediately after connection to provide full cluster state.

**Server → Client**
```json
{
  "type": "initial_state",
  "data": {
    "nodes": [
      {
        "name": "node-1",
        "uid": "abc-123",
        "status": "Ready",
        "role": "worker",
        "capacity": {
          "cpu": "4000m",
          "memory": "8Gi",
          "pods": "110"
        },
        "conditions": [],
        "labels": {},
        "creationTimestamp": "2025-01-24T09:00:00Z"
      }
    ],
    "pods": [
      {
        "name": "my-pod",
        "uid": "def-456",
        "namespace": "default",
        "nodeName": "node-1",
        "phase": "Running",
        "status": "Running",
        "containers": [
          {
            "name": "main",
            "image": "nginx:latest",
            "ready": true
          }
        ],
        "labels": {},
        "creationTimestamp": "2025-01-24T09:30:00Z"
      }
    ],
    "namespaces": [
      {
        "name": "default",
        "uid": "ghi-789",
        "status": "Active",
        "podCount": 15
      }
    ]
  },
  "timestamp": "2025-01-24T10:00:01Z"
}
```

### 2. Resource Update Events
Real-time updates for individual resources.

**Server → Client: Node Event**
```json
{
  "type": "node_event",
  "action": "MODIFIED",
  "data": {
    "name": "node-1",
    "uid": "abc-123",
    "status": "NotReady",
    "role": "worker",
    "capacity": {
      "cpu": "4000m",
      "memory": "8Gi",
      "pods": "110"
    },
    "conditions": [
      {
        "type": "Ready",
        "status": "False",
        "reason": "NodeNotReady",
        "message": "Node is not ready"
      }
    ]
  },
  "timestamp": "2025-01-24T10:01:00Z"
}
```

**Server → Client: Pod Event**
```json
{
  "type": "pod_event",
  "action": "ADDED",
  "data": {
    "name": "new-pod",
    "uid": "jkl-012",
    "namespace": "default",
    "nodeName": "node-2",
    "phase": "Pending",
    "status": "Pending",
    "containers": []
  },
  "timestamp": "2025-01-24T10:01:30Z"
}
```

**Server → Client: Pod Deletion**
```json
{
  "type": "pod_event",
  "action": "DELETED",
  "data": {
    "uid": "jkl-012",
    "name": "new-pod",
    "namespace": "default"
  },
  "timestamp": "2025-01-24T10:02:00Z"
}
```

### 3. Error Messages
**Server → Client: Error**
```json
{
  "type": "error",
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Insufficient RBAC permissions to watch pods",
    "details": "Missing 'watch' permission on 'pods' in namespace 'kube-system'"
  },
  "timestamp": "2025-01-24T10:00:00Z"
}
```

### 4. Heartbeat
Keep connection alive and detect stale connections.

**Client → Server: Ping**
```json
{
  "type": "ping",
  "timestamp": "2025-01-24T10:03:00Z"
}
```

**Server → Client: Pong**
```json
{
  "type": "pong",
  "timestamp": "2025-01-24T10:03:00Z"
}
```

### 5. Metrics Update
Periodic cluster metrics updates.

**Server → Client**
```json
{
  "type": "metrics",
  "data": {
    "totalNodes": 5,
    "readyNodes": 4,
    "totalPods": 150,
    "runningPods": 140,
    "pendingPods": 8,
    "failedPods": 2
  },
  "timestamp": "2025-01-24T10:04:00Z"
}
```

## Event Actions

### Valid Actions
- `ADDED`: New resource created
- `MODIFIED`: Existing resource updated
- `DELETED`: Resource removed

## Error Codes

| Code | Description |
|------|-------------|
| `CONNECTION_FAILED` | Unable to connect to Kubernetes cluster |
| `PERMISSION_DENIED` | Insufficient RBAC permissions |
| `INVALID_KUBECONFIG` | Kubeconfig file invalid or not found |
| `CLUSTER_UNREACHABLE` | Cluster API not responding |
| `WATCH_ERROR` | Error in watch stream |
| `RATE_LIMITED` | Too many requests |

## Connection Management

### Reconnection Strategy
1. Client detects disconnect (no pong response or connection closed)
2. Wait 1 second, attempt reconnect
3. On failure, exponential backoff: 2s, 4s, 8s, max 30s
4. After 5 failed attempts, show error to user

### Connection Parameters
- Heartbeat interval: 30 seconds
- Heartbeat timeout: 10 seconds
- Max message size: 10MB
- Compression: enabled for messages > 1KB

## Rate Limiting
- Max 1000 messages per minute per client
- Burst allowance: 50 messages
- Events are batched if rate limit approached

## Security
- WebSocket connection requires same-origin or CORS headers
- No authentication required (backend handles kubeconfig)
- All data is read-only (no modification operations)
- Sensitive data (secrets, configmaps) excluded from responses