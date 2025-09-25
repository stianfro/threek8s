# ThreeK8s - 3D Kubernetes Cluster Visualization

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org)
[![Three.js](https://img.shields.io/badge/Three.js-Latest-orange)](https://threejs.org)
[![License](https://img.shields.io/badge/License-MIT-purple)](LICENSE)

A real-time 3D visualization tool for Kubernetes clusters using Three.js. Watch your nodes and pods come to life in an interactive 3D space with smooth animations and live updates.

## ✨ Features

- **3D Visualization**: Nodes displayed as large boxes containing pods as smaller boxes
- **Real-time Updates**: Live synchronization with your Kubernetes cluster via WebSocket
- **Interactive Controls**: Rotate, pan, zoom, and interact with objects
- **Smart Animations**: Smooth transitions for pod creation, deletion, and status changes
- **Multi-namespace Support**: View all pods across all namespaces
- **Color-coded Status**: Visual indicators for different pod and node states
- **Hover Information**: Detailed tooltips showing resource information
- **Performance Optimized**: Handles clusters with 100+ nodes efficiently

## 🚀 Quick Start

### Using Just (Recommended)

[Just](https://github.com/casey/just) is a command runner that simplifies running multiple commands.

```bash
# Install just (macOS)
brew install just

# Install just (Linux)
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# Clone and setup
git clone https://github.com/yourusername/threek8s.git
cd threek8s

# One-time setup
just init

# Start both servers
just dev
```

### Manual Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/threek8s.git
cd threek8s

# Install dependencies
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Start both servers
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser to view the visualization.

## 📋 Prerequisites

- **Node.js** 20.0.0 or higher
- **npm** 9.0.0 or higher
- **Kubernetes cluster** with valid kubeconfig
- **RBAC permissions** to read nodes, pods, and namespaces
- **just** (optional but recommended) - [Installation instructions](https://github.com/casey/just#installation)

### Required Kubernetes Permissions

Create a ClusterRole with the necessary permissions:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: threek8s-viewer
rules:
- apiGroups: [""]
  resources: ["nodes", "pods", "namespaces"]
  verbs: ["get", "list", "watch"]
```

Bind it to your service account or user:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: threek8s-viewer-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: threek8s-viewer
subjects:
- kind: User
  name: your-username
  apiGroup: rbac.authorization.k8s.io
```

## ⚙️ Configuration

### Backend Configuration (`backend/.env`)

```env
# Server Configuration
PORT=3001                           # Backend server port

# Kubernetes Configuration
KUBECONFIG_PATH=~/.kube/config     # Path to kubeconfig file

# CORS Configuration
CORS_ORIGINS=http://localhost:5173  # Allowed origins (comma-separated)

# WebSocket Configuration
WS_HEARTBEAT_INTERVAL=30000        # Heartbeat interval in ms
WS_HEARTBEAT_TIMEOUT=10000         # Heartbeat timeout in ms

# Environment
NODE_ENV=development                # development or production
```

### Frontend Configuration (`frontend/.env`)

```env
# API Configuration
VITE_API_URL=http://localhost:3001/api  # Backend API URL
VITE_WS_URL=ws://localhost:3001/ws      # WebSocket URL
```

## 🎮 Usage Guide

### Controls

| Action | Control |
|--------|---------|
| **Rotate View** | Left-click and drag |
| **Pan View** | Right-click and drag |
| **Zoom In/Out** | Scroll wheel |
| **Select Object** | Left-click on node or pod |
| **Focus Object** | Double-click on node or pod |
| **View Details** | Hover over objects |

### Understanding the Visualization

#### Node Representation
- **Large Boxes**: Kubernetes nodes
- **Green**: Ready nodes
- **Orange**: NotReady nodes
- **Gray**: Unknown status

#### Pod Representation
- **Small Boxes**: Pods (positioned inside their nodes)
- **Blue**: Running pods
- **Yellow**: Pending pods
- **Green**: Succeeded pods
- **Red**: Failed pods
- **Orange**: Terminating pods
- **Cyan**: ContainerCreating
- **Pink**: CrashLoopBackOff
- **Purple**: ImagePull errors

#### Visual Effects
- **Rotating**: Pending or selected pods
- **Shaking**: Failed or CrashLoopBackOff pods
- **Fade In**: New pods being created
- **Fade Out**: Pods being deleted
- **Glowing Outline**: Selected objects

## 🛠️ Development

### Project Structure

```
threek8s/
├── backend/                 # Node.js backend server
│   ├── src/
│   │   ├── api/            # REST API endpoints
│   │   │   └── routes/     # Express routes
│   │   ├── models/         # Data models
│   │   ├── services/       # Core services
│   │   │   ├── KubernetesService.ts
│   │   │   ├── WebSocketManager.ts
│   │   │   ├── StateManager.ts
│   │   │   ├── WatchManager.ts
│   │   │   └── EventProcessor.ts
│   │   ├── app.ts          # Express app setup
│   │   └── index.ts        # Server entry point
│   ├── tests/              # Test files
│   └── package.json
├── frontend/               # Vite + Three.js frontend
│   ├── src/
│   │   ├── scene/          # Three.js scene management
│   │   ├── visualization/  # 3D object components
│   │   │   ├── NodeObject.ts
│   │   │   ├── PodObject.ts
│   │   │   └── VisualizationManager.ts
│   │   ├── services/       # API and WebSocket clients
│   │   ├── types/          # TypeScript types
│   │   └── main.ts         # App entry point
│   └── package.json
└── README.md
```

### Available Commands

#### Using Just (Recommended)

```bash
# Development
just dev            # Start both servers
just backend        # Start only backend
just frontend       # Start only frontend
just stop          # Stop all servers

# Building & Testing
just build          # Build both projects
just test          # Run all tests
just lint          # Lint all code
just format        # Format all code

# Utilities
just logs          # Show server status
just check-k8s     # Check Kubernetes connection
just env           # Show environment config
just clean         # Clean build artifacts

# Docker
just docker-build  # Build Docker images
just docker-run    # Run with Docker Compose
just docker-stop   # Stop containers

# Type 'just' to see all available commands
```

#### Manual Commands

##### Backend Scripts

```bash
npm run dev          # Start with hot reload
npm run build        # Build for production
npm start           # Start production server
npm test            # Run all tests
npm run lint        # Run ESLint
npm run format      # Format with Prettier
```

##### Frontend Scripts

```bash
npm run dev         # Start dev server
npm run build       # Build for production
npm run preview     # Preview production build
npm run lint        # Run ESLint
```

### Running Tests

```bash
# Backend tests
cd backend
npm test                    # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:watch         # Watch mode

# Frontend tests (when available)
cd frontend
npm test
```

## 🚢 Deployment

### Docker Deployment

Using just commands:

```bash
# Build images
just docker-build

# Run with docker-compose
just docker-run

# Stop containers
just docker-stop
```

Manual Docker commands:

```bash
# Build images
docker build -t threek8s-backend ./backend
docker build -t threek8s-frontend ./frontend

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

The application includes:
- **Dockerfiles** for both backend and frontend
- **docker-compose.yml** for orchestration
- **nginx.conf** for optimized frontend serving
- Health checks for both services
- Non-root user execution for security

### Kubernetes Deployment

Deploy ThreeK8s inside your cluster:

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: threek8s
  namespace: threek8s
spec:
  replicas: 1
  selector:
    matchLabels:
      app: threek8s
  template:
    metadata:
      labels:
        app: threek8s
    spec:
      serviceAccountName: threek8s-viewer
      containers:
      - name: backend
        image: threek8s-backend:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
      - name: frontend
        image: threek8s-frontend:latest
        ports:
        - containerPort: 80
```

## 🔍 Troubleshooting

### Backend Cannot Connect to Kubernetes

**Problem**: "Failed to connect to Kubernetes cluster"

**Solutions**:
1. Verify kubeconfig exists and is valid:
   ```bash
   kubectl cluster-info
   ```
2. Check the path in `backend/.env`
3. Ensure proper RBAC permissions:
   ```bash
   kubectl auth can-i list pods --all-namespaces
   kubectl auth can-i list nodes
   ```

### WebSocket Connection Fails

**Problem**: "WebSocket connection failed"

**Solutions**:
1. Verify backend is running:
   ```bash
   curl http://localhost:3001/api/health
   ```
2. Check WebSocket URL in `frontend/.env`
3. Look for CORS errors in browser console
4. Check firewall/proxy settings

### No Pods Visible

**Problem**: Visualization shows no pods

**Solutions**:
1. Verify pods exist:
   ```bash
   kubectl get pods --all-namespaces
   ```
2. Check API response:
   ```bash
   curl http://localhost:3001/api/pods
   ```
3. Check browser console for errors
4. Ensure WebSocket is connected (check status indicator)

### Performance Issues

**Problem**: Low FPS or high memory usage

**Solutions**:
1. Use production builds:
   ```bash
   npm run build && npm start
   ```
2. Increase WebSocket heartbeat interval
3. Reduce animation quality
4. Filter by namespace to reduce pod count

## 📊 Performance

### Optimization Tips

1. **For Large Clusters (100+ nodes)**:
   - Use production builds
   - Increase WebSocket heartbeat interval
   - Consider implementing pagination

2. **Browser Performance**:
   - Use Chrome or Firefox for best WebGL support
   - Enable hardware acceleration
   - Close unnecessary browser tabs

3. **Network Optimization**:
   - Deploy backend close to Kubernetes API server
   - Use WebSocket compression
   - Implement caching for static resources

### Expected Performance

| Cluster Size | Nodes | Pods | Target FPS | Memory |
|-------------|-------|------|-----------|--------|
| Small       | 10    | 100  | 60        | ~150MB |
| Medium      | 50    | 500  | 60        | ~300MB |
| Large       | 100   | 1000 | 45        | ~500MB |
| X-Large     | 200   | 2000 | 30        | ~800MB |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Three.js](https://threejs.org/) for 3D graphics
- [Kubernetes Client](https://github.com/kubernetes-client/javascript) for K8s API access
- [Express](https://expressjs.com/) for backend framework
- [Vite](https://vitejs.dev/) for frontend tooling

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

Made with ❤️ for the Kubernetes community