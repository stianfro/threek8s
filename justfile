# ThreeK8s Justfile - Task runner for development and deployment
# https://github.com/casey/just

# Default command - show available commands
default:
    @just --list

# Install all dependencies for both frontend and backend
install:
    @echo "📦 Installing backend dependencies..."
    cd backend && npm install
    @echo "📦 Installing frontend dependencies..."
    cd frontend && npm install
    @echo "✅ All dependencies installed!"

# Setup environment files from examples
setup:
    @echo "🔧 Setting up environment files..."
    @if [ ! -f backend/.env ]; then \
        cp backend/.env.example backend/.env && \
        echo "✅ Created backend/.env from example"; \
    else \
        echo "ℹ️  backend/.env already exists"; \
    fi
    @if [ ! -f frontend/.env ]; then \
        cp frontend/.env.example frontend/.env && \
        echo "✅ Created frontend/.env from example"; \
    else \
        echo "ℹ️  frontend/.env already exists"; \
    fi
    @echo "📝 Please edit the .env files with your configuration"

# Run both frontend and backend in development mode
dev:
    @echo "🚀 Starting development servers..."
    @echo "Backend: http://localhost:3001"
    @echo "Frontend: http://localhost:5173"
    @echo "Press Ctrl+C to stop both servers"
    @echo ""
    @just dev-simple

# Run in mock mode with specified node and pod count
dev-mock nodes="40" pods="7000":
    @echo "🧪 Starting development servers in MOCK mode..."
    @echo "📊 Mocking {{nodes}} nodes with {{pods}} pods"
    @echo "Backend: http://localhost:3001"
    @echo "Frontend: http://localhost:5173"
    @echo "Press Ctrl+C to stop both servers"
    @echo ""
    @MOCK_MODE=true MOCK_NODE_COUNT={{nodes}} MOCK_POD_COUNT={{pods}} just dev-simple

# Run in mock mode with dynamic updates
dev-mock-dynamic nodes="5" pods="50" interval="3000":
    @echo "🧪 Starting development servers in MOCK mode with dynamic updates..."
    @echo "📊 Mocking {{nodes}} nodes with {{pods}} pods"
    @echo "🔄 Dynamic updates every {{interval}}ms"
    @echo "Backend: http://localhost:3001"
    @echo "Frontend: http://localhost:5173"
    @echo "Press Ctrl+C to stop both servers"
    @echo ""
    @MOCK_MODE=true MOCK_NODE_COUNT={{nodes}} MOCK_POD_COUNT={{pods}} MOCK_DYNAMIC_UPDATES=true MOCK_UPDATE_INTERVAL={{interval}} just dev-simple

# Run development servers using tmux for split view
dev-tmux:
    @echo "🚀 Starting development servers in tmux..."
    @tmux new-session -d -s threek8s -n dev
    @tmux send-keys -t threek8s:dev "cd backend && npm run dev" C-m
    @tmux split-window -t threek8s:dev -h
    @tmux send-keys -t threek8s:dev.1 "cd frontend && npm run dev" C-m
    @tmux split-window -t threek8s:dev -v
    @tmux send-keys -t threek8s:dev.2 "sleep 3 && just logs" C-m
    @tmux select-pane -t threek8s:dev.0
    @tmux attach-session -t threek8s

# Simple development mode without tmux (runs in foreground)
dev-simple:
    @echo "🚀 Starting development servers..."
    @echo ""
    @echo "📡 Backend:  http://localhost:3001"
    @echo "🎨 Frontend: http://localhost:5173"
    @echo ""
    @echo "⏳ Starting servers... (Press Ctrl+C to stop both)"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @(trap 'echo ""; echo "🛑 Stopping servers..."; kill 0' SIGINT; \
        (cd backend && npm run dev 2>&1 | sed 's/^/[BACKEND] /') & \
        backend_pid=$$!; \
        (cd frontend && npm run dev 2>&1 | sed 's/^/[FRONTEND] /') & \
        frontend_pid=$$!; \
        sleep 3; \
        echo ""; \
        echo "✅ Servers are running!"; \
        echo ""; \
        echo "📌 Frontend: http://localhost:5173"; \
        echo "📌 Backend API: http://localhost:3001/api"; \
        echo "📌 WebSocket: ws://localhost:3001/ws"; \
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; \
        wait)

# Start only the backend server
backend:
    @echo "🔧 Starting backend server..."
    cd backend && npm run dev

# Start only the frontend server
frontend:
    @echo "🎨 Starting frontend server..."
    cd frontend && npm run dev

# Build both projects for production
build:
    @echo "🏗️  Building backend..."
    cd backend && npm run build
    @echo "🏗️  Building frontend..."
    cd frontend && npm run build
    @echo "✅ Build complete!"

# Build only backend
build-backend:
    @echo "🏗️  Building backend..."
    cd backend && npm run build

# Build only frontend
build-frontend:
    @echo "🏗️  Building frontend..."
    cd frontend && npm run build

# Start production servers
prod:
    @echo "🚀 Starting production servers..."
    @(trap 'kill 0' SIGINT; \
        (cd backend && npm start 2>&1 | sed 's/^/[BACKEND] /') & \
        (cd frontend && npm run preview 2>&1 | sed 's/^/[FRONTEND] /') & \
        wait)

# Run all tests
test:
    @echo "🧪 Running backend tests..."
    cd backend && npm test
    @echo "🧪 Running frontend tests (if available)..."
    @if [ -f "frontend/package.json" ] && grep -q '"test"' frontend/package.json; then \
        cd frontend && npm test; \
    else \
        echo "ℹ️  No frontend tests configured"; \
    fi

# Run backend tests only
test-backend:
    @echo "🧪 Running backend tests..."
    cd backend && npm test

# Run backend tests in watch mode
test-watch:
    @echo "🧪 Running backend tests in watch mode..."
    cd backend && npm run test:watch

# Lint all code
lint:
    @echo "🔍 Linting backend..."
    cd backend && npm run lint
    @echo "🔍 Linting frontend..."
    cd frontend && npm run lint

# Run security checks on all code
security:
    @echo "🔒 Running security checks..."
    @echo ""
    @echo "Backend Security Scan:"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cd backend && npm run security:check
    @echo ""
    @echo "Frontend Security Scan:"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cd frontend && npm run security:check
    @echo ""
    @echo "✅ Security checks complete!"

# Run security linting only (SAST)
security-lint:
    @echo "🔍 Running security linting (SAST)..."
    cd backend && npm run lint:security
    cd frontend && npm run lint:security
    @echo "✅ Security linting complete!"

# Run dependency audit only
security-audit:
    @echo "📦 Running dependency audit..."
    cd backend && npm run audit
    cd frontend && npm run audit
    @echo "✅ Dependency audit complete!"

# Format all code
format:
    @echo "💅 Formatting backend code..."
    cd backend && npm run format
    @echo "💅 Formatting frontend code..."
    @if grep -q '"format"' frontend/package.json; then \
        cd frontend && npm run format; \
    else \
        echo "ℹ️  No format script in frontend"; \
    fi

# Clean build artifacts and node_modules
clean:
    @echo "🧹 Cleaning build artifacts..."
    rm -rf backend/dist frontend/dist
    @echo "✅ Build artifacts cleaned!"

# Deep clean including node_modules
clean-all:
    @echo "🧹 Deep cleaning project..."
    rm -rf backend/dist backend/node_modules
    rm -rf frontend/dist frontend/node_modules
    @echo "✅ Project cleaned! Run 'just install' to reinstall dependencies."

# Check Kubernetes connection
check-k8s:
    @echo "🔍 Checking Kubernetes connection..."
    @kubectl cluster-info &> /dev/null && \
        echo "✅ Connected to cluster: $$(kubectl config current-context)" || \
        echo "❌ Not connected to Kubernetes cluster"
    @echo ""
    @echo "📊 Cluster resources:"
    @kubectl get nodes --no-headers 2>/dev/null | wc -l | xargs echo "  Nodes:"
    @kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l | xargs echo "  Pods:"
    @kubectl get namespaces --no-headers 2>/dev/null | wc -l | xargs echo "  Namespaces:"

# Setup KWOK test cluster with 40 nodes across 3 zones
kwok-setup:
    @echo "🧪 Setting up KWOK test cluster..."
    @./scripts/setup-kwok-cluster.sh

# Cleanup KWOK test cluster
kwok-cleanup:
    @echo "🧹 Cleaning up KWOK test cluster..."
    @./scripts/cleanup-kwok-cluster.sh

# Show KWOK cluster info
kwok-info:
    @echo "📊 KWOK Cluster Information"
    @echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    @echo ""
    @if kwokctl get clusters 2>/dev/null | grep -q "threek8s-test"; then \
        echo "✅ Cluster: threek8s-test (running)"; \
        echo ""; \
        echo "📍 Context: $$(kubectl config current-context)"; \
        echo ""; \
        echo "📦 Nodes by zone:"; \
        kubectl get nodes -L topology.kubernetes.io/zone --no-headers 2>/dev/null | \
            awk '{print $$6}' | sort | uniq -c | awk '{printf "   %s: %d nodes\n", $$2, $$1}'; \
        echo ""; \
        echo "🎯 Total pods: $$(kubectl get pods -n test-workload --no-headers 2>/dev/null | wc -l | xargs)"; \
        echo ""; \
        echo "🔗 Next steps:"; \
        echo "   just dev     - Start threek8s with this cluster"; \
        echo "   just kwok-cleanup - Remove the test cluster"; \
    else \
        echo "❌ KWOK test cluster not found"; \
        echo ""; \
        echo "🔗 Run 'just kwok-setup' to create it"; \
    fi

# Setup KWOK cluster and start development servers
kwok-dev: kwok-setup dev

# Show logs from both servers (requires both to be running)
logs:
    @echo "📜 Monitoring application..."
    @echo "Backend health: $$(curl -s http://localhost:3001/api/health | grep -o '"status":"[^"]*"' || echo 'Not running')"
    @echo "Frontend status: $$(curl -s http://localhost:5173 &>/dev/null && echo 'Running' || echo 'Not running')"
    @echo ""
    @echo "WebSocket endpoint: ws://localhost:3001/ws"
    @echo "API endpoint: http://localhost:3001/api"
    @echo "Frontend URL: http://localhost:5173"

# Stop all development servers
stop:
    @echo "🛑 Stopping development servers..."
    @tmux kill-session -t threek8s 2>/dev/null || true
    @pkill -f "npm run dev" 2>/dev/null || true
    @pkill -f "vite" 2>/dev/null || true
    @pkill -f "tsx watch" 2>/dev/null || true
    @echo "✅ All servers stopped!"

# Docker build
docker-build:
    @echo "🐳 Building Docker images..."
    docker build -t threek8s-backend ./backend
    docker build -t threek8s-frontend ./frontend
    @echo "✅ Docker images built!"

# Docker run
docker-run:
    @echo "🐳 Starting Docker containers..."
    docker-compose up -d
    @echo "✅ Containers started!"
    @echo "Frontend: http://localhost:5173"
    @echo "Backend: http://localhost:3001"

# Docker stop
docker-stop:
    @echo "🐳 Stopping Docker containers..."
    docker-compose down
    @echo "✅ Containers stopped!"

# Show environment configuration
env:
    @echo "🔧 Current Environment Configuration:"
    @echo ""
    @echo "Backend (.env):"
    @if [ -f backend/.env ]; then \
        cat backend/.env | grep -v '^#' | grep -v '^$$'; \
    else \
        echo "  ⚠️  No backend/.env file found"; \
    fi
    @echo ""
    @echo "Frontend (.env):"
    @if [ -f frontend/.env ]; then \
        cat frontend/.env | grep -v '^#' | grep -v '^$$'; \
    else \
        echo "  ⚠️  No frontend/.env file found"; \
    fi

# Full setup from scratch
init: install setup
    @echo "🎉 Project initialized!"
    @echo ""
    @echo "Next steps:"
    @echo "1. Edit backend/.env and frontend/.env with your configuration"
    @echo "2. Run 'just dev' to start development servers"
    @echo "3. Open http://localhost:5173 in your browser"

# Help command with detailed information
help:
    @echo "ThreeK8s - 3D Kubernetes Visualization"
    @echo "======================================"
    @echo ""
    @echo "Quick Start:"
    @echo "  just init    - First time setup (install + configure)"
    @echo "  just dev     - Start both servers in development mode"
    @echo "  just stop    - Stop all running servers"
    @echo ""
    @echo "Development:"
    @echo "  just backend - Start only backend server"
    @echo "  just frontend - Start only frontend server"
    @echo "  just test    - Run all tests"
    @echo "  just lint    - Lint all code"
    @echo "  just format  - Format all code"
    @echo ""
    @echo "Security:"
    @echo "  just security       - Run all security checks (SAST + audit)"
    @echo "  just security-lint  - Run security linting only (SAST)"
    @echo "  just security-audit - Run dependency audit only"
    @echo ""
    @echo "Testing with KWOK:"
    @echo "  just kwok-setup   - Create test cluster (40 nodes, 3 zones)"
    @echo "  just kwok-dev     - Setup KWOK cluster and start dev servers"
    @echo "  just kwok-info    - Show KWOK cluster status"
    @echo "  just kwok-cleanup - Remove KWOK test cluster"
    @echo ""
    @echo "Production:"
    @echo "  just build   - Build for production"
    @echo "  just prod    - Run production servers"
    @echo ""
    @echo "Utilities:"
    @echo "  just logs    - Show server status and endpoints"
    @echo "  just check-k8s - Check Kubernetes connection"
    @echo "  just env     - Show environment configuration"
    @echo "  just clean   - Clean build artifacts"
    @echo ""
    @echo "Docker:"
    @echo "  just docker-build - Build Docker images"
    @echo "  just docker-run   - Run with Docker Compose"
    @echo "  just docker-stop  - Stop Docker containers"
