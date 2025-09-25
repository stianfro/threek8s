# Quickstart: Kubernetes 3D Visualization

## Prerequisites

Before starting, ensure you have:
- Node.js 20+ and npm installed
- Access to a Kubernetes cluster
- A valid kubeconfig file (~/.kube/config or custom path)
- Cluster-reader permissions (or equivalent RBAC)

## Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd threek8s

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment

Create a `.env` file in the backend directory:

```bash
# backend/.env
KUBECONFIG_PATH=~/.kube/config  # Path to your kubeconfig
PORT=3001                        # Backend port
WS_PORT=3001                     # WebSocket port (same as backend)
```

### 3. Verify Cluster Permissions

Check that you have the required permissions:

```bash
# Test cluster access
kubectl auth can-i list nodes --all-namespaces
kubectl auth can-i list pods --all-namespaces
kubectl auth can-i watch pods --all-namespaces
```

All commands should return "yes". If not, ask your cluster admin for cluster-reader role.

## Running the Application

### Development Mode

Start both backend and frontend in development mode:

```bash
# Terminal 1: Start the backend
cd backend
npm run dev

# Terminal 2: Start the frontend
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api
- WebSocket: ws://localhost:3001/ws

### Production Build

```bash
# Build frontend
cd frontend
npm run build

# Build backend
cd ../backend
npm run build

# Start production server
npm start
```

## Basic Usage

### 1. Initial Connection

When you open the application, it will automatically:
1. Connect to the backend via WebSocket
2. Load the current cluster state
3. Display all nodes and pods in 3D space

### 2. Navigation Controls

- **Left Click + Drag**: Rotate the view
- **Right Click + Drag**: Pan the camera
- **Scroll Wheel**: Zoom in/out
- **Double Click**: Center on object

### 3. Interacting with Resources

**Hover over a Node:**
- Shows node name and status
- Displays resource capacity
- Highlights all pods on that node

**Hover over a Pod:**
- Shows pod name and namespace
- Displays pod phase and status
- Shows container information

**Click on a Resource:**
- Opens detailed information panel
- Shows labels and annotations
- Displays recent events

### 4. Real-time Updates

The visualization automatically updates when:
- New pods are created (fade-in animation)
- Pods are deleted (fade-out animation)
- Pod status changes (color change)
- Nodes change status (visual indicator)

## Validation Tests

### Test 1: Basic Connectivity

1. Open browser developer console
2. Navigate to http://localhost:5173
3. Check console for: "WebSocket connected to cluster"
4. Verify nodes appear as large boxes
5. Verify pods appear as smaller boxes inside nodes

**Expected Result:** 3D visualization loads with your cluster's resources

### Test 2: Real-time Updates

1. In a terminal, create a test pod:
```bash
kubectl run test-pod --image=nginx
```

2. Watch the visualization for a new pod appearing
3. The pod should fade in with "Pending" status (yellow)
4. After scheduling, it should turn green (Running)

**Expected Result:** Pod appears with animation and correct status

### Test 3: Pod Deletion

1. Delete the test pod:
```bash
kubectl delete pod test-pod
```

2. Watch the visualization for the pod removal
3. The pod should fade out and disappear

**Expected Result:** Pod animates out and is removed from view

### Test 4: Hover Information

1. Hover over any node
2. Verify tooltip shows:
   - Node name
   - Status (Ready/NotReady)
   - Resource capacity

3. Hover over any pod
4. Verify tooltip shows:
   - Pod name
   - Namespace
   - Phase (Running/Pending/etc.)

**Expected Result:** Tooltips display correct information

### Test 5: Multiple Namespaces

1. Check that pods from different namespaces are visible
2. Look for system pods (kube-system namespace)
3. Verify namespace labels on pods

**Expected Result:** Pods from all namespaces are displayed

### Test 6: Performance with Load

1. If your cluster has 50+ pods, verify:
   - Smooth rotation (60 fps)
   - Responsive hover effects
   - No lag during updates

**Expected Result:** Performance remains smooth

## Troubleshooting

### "Cannot connect to cluster"

1. Check backend logs for connection errors
2. Verify kubeconfig path in .env
3. Test cluster access: `kubectl cluster-info`
4. Check RBAC permissions

### "WebSocket connection failed"

1. Ensure backend is running on correct port
2. Check for CORS issues in browser console
3. Verify no firewall blocking WebSocket

### "No pods visible"

1. Check you have pods in the cluster: `kubectl get pods -A`
2. Verify namespace permissions
3. Check browser console for errors

### "Poor performance"

1. Check pod count: `kubectl get pods -A | wc -l`
2. If >1000 pods, consider namespace filtering
3. Ensure hardware acceleration is enabled in browser
4. Try different browser (Chrome recommended)

## Advanced Configuration

### Filtering Namespaces

To show only specific namespaces, modify the WebSocket connection:

```javascript
// frontend/src/services/websocket.js
const ws = new WebSocket('ws://localhost:3001/ws?namespaces=default,production');
```

### Adjusting Update Rate

For clusters with rapid changes, adjust the batching window:

```javascript
// backend/src/config.js
export const UPDATE_BATCH_WINDOW = 200; // milliseconds
```

### Custom Node Layout

Modify the layout algorithm in:
```javascript
// frontend/src/visualization/layout.js
export const calculateNodePositions = (nodes) => {
  // Custom layout logic
};
```

## Success Criteria

The quickstart is successful when:

✅ Application connects to your Kubernetes cluster
✅ All nodes are visible as 3D boxes
✅ All pods are visible inside their respective nodes
✅ Hover shows resource information
✅ Creating a pod shows animation
✅ Deleting a pod shows animation
✅ Navigation controls work smoothly
✅ No errors in browser console
✅ WebSocket maintains stable connection

## Next Steps

After successful quickstart:
1. Customize the visualization colors and layout
2. Add additional resource types (services, deployments)
3. Implement resource filtering and search
4. Add performance metrics visualization
5. Set up monitoring and alerting

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs: `docker logs threek8s-backend`
3. Check browser console for errors
4. Verify cluster permissions with kubectl