import * as THREE from 'three';
import { SceneManager } from '../scene/SceneManager';
import { NodeObject } from './NodeObject';
import { PodObject } from './PodObject';
import { PodInstanceManager } from './PodInstanceManager';
import { GeometryPool } from './GeometryPool';
import { LODManager, DetailLevel } from './LODManager';
import type { KubernetesNode, Pod, ClusterState } from '../types/kubernetes';

export class VisualizationManager {
  private sceneManager: SceneManager;
  private nodes: Map<string, NodeObject> = new Map();
  private nodesByName: Map<string, NodeObject> = new Map();
  private pods: Map<string, PodObject> = new Map();
  private nodeGroup: THREE.Group;
  private podGroup: THREE.Group;
  private lastUpdateTime: number = Date.now();
  private isInitialized: boolean = false;
  private lastLayout: { positions: THREE.Vector3[], scale: number } | null = null;
  private initialZoomApplied: boolean = false;
  private layoutLocked: boolean = false;
  private referenceViewport: { width: number; height: number } | null = null;
  private podInstanceManager: PodInstanceManager | null = null;
  private useInstancedRendering: boolean = true;
  private geometryPool: GeometryPool;
  private frustum: THREE.Frustum = new THREE.Frustum();
  private cameraMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private lodManager: LODManager;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.geometryPool = GeometryPool.getInstance();
    this.lodManager = new LODManager(this.sceneManager.getCamera());

    this.nodeGroup = new THREE.Group();
    this.nodeGroup.name = 'nodes';
    this.sceneManager.addObject(this.nodeGroup);

    this.podGroup = new THREE.Group();
    this.podGroup.name = 'pods';
    this.sceneManager.addObject(this.podGroup);

    // Initialize instanced rendering for pods if we have many of them
    this.checkAndInitializeInstancedRendering();

    // Add resize handler for dynamic viewport updates
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize = (): void => {
    // Skip resize handling during initial setup to prevent double animations
    if (!this.isInitialized) {
      return;
    }

    // On actual window resize, we need to recalculate the reference viewport
    if (this.nodes.size > 0) {
      // Reset reference viewport to recalculate based on new window size
      const oldViewport = this.referenceViewport;
      this.referenceViewport = null;

      const nodeCount = this.nodes.size;
      const layout = this.calculateLayout(nodeCount);

      // Check if the layout has changed significantly
      if (this.hasLayoutChanged(layout)) {
        // Update node positions using the new layout
        let index = 0;
        this.nodes.forEach((node) => {
          this.animateNodePosition(node, layout.positions[index]);
          this.animateNodeScale(node, layout.scale);
          index++;
        });

        this.lastLayout = layout;
        // Adjust camera after resize
        if (this.initialZoomApplied) {
          this.adjustCameraForContent();
        }
      } else {
        // Restore old viewport if no significant change
        this.referenceViewport = oldViewport;
      }
    }
  }

  private hasLayoutChanged(newLayout: { positions: THREE.Vector3[], scale: number }): boolean {
    if (!this.lastLayout) return true;

    // Check if scale changed significantly
    if (Math.abs(this.lastLayout.scale - newLayout.scale) > 0.01) return true;

    // Check if any position changed significantly
    for (let i = 0; i < newLayout.positions.length; i++) {
      if (!this.lastLayout.positions[i]) return true;
      if (this.lastLayout.positions[i].distanceTo(newLayout.positions[i]) > 0.1) {
        return true;
      }
    }

    return false;
  }

  public updateState(state: ClusterState): void {
    console.log('[VisualizationManager] Updating state:', {
      nodes: state.nodes.length,
      pods: state.pods.length
    });
    this.updateNodes(state.nodes);
    this.updatePods(state.pods);
  }

  private updateNodes(nodes: KubernetesNode[]): void {
    const currentNodeIds = new Set(nodes.map(n => n.uid));

    // Track if this is initial setup
    const isInitialSetup = this.nodes.size === 0;

    // Check if node count has changed
    const nodeCountChanged = this.nodes.size !== nodes.length;

    // Only recalculate layout if it's initial setup, node count changed, or layout isn't locked
    let layout = this.lastLayout;
    if (!layout || isInitialSetup || (nodeCountChanged && !this.layoutLocked)) {
      layout = this.calculateLayout(nodes.length);
      this.lastLayout = layout;

      // Lock layout after initial setup
      if (isInitialSetup && nodes.length > 0) {
        this.layoutLocked = true;
      }
    } else {
    }

    nodes.forEach((nodeData, index) => {
      let node = this.nodes.get(nodeData.uid);

      if (!node) {
        console.log('[VisualizationManager] Creating new node:', nodeData.name);
        node = new NodeObject(nodeData, this.geometryPool);
        this.nodes.set(nodeData.uid, node);
        this.nodesByName.set(nodeData.name, node);
        this.nodeGroup.add(node);

        // Set the final position and scale immediately
        node.position.copy(layout.positions[index]);
        node.scale.setScalar(layout.scale);

        // Only animate if not initial setup
        if (!isInitialSetup) {
          // For new nodes after initial setup, start from scale 0
          node.scale.set(0, 0, 0);
          this.animateNodeCreation(node, layout.scale);
        }
      } else {
        node.updateNode(nodeData);
        // Only animate if layout has actually changed
        const scaleChanged = Math.abs(node.scale.x - layout.scale) > 0.01;
        const positionChanged = node.position.distanceTo(layout.positions[index]) > 0.1;

        if (scaleChanged || positionChanged) {
          if (positionChanged) {
            this.animateNodePosition(node, layout.positions[index]);
          }
          if (scaleChanged) {
            this.animateNodeScale(node, layout.scale);
          }
        }
      }
    });

    this.nodes.forEach((node, uid) => {
      if (!currentNodeIds.has(uid)) {
        this.nodesByName.delete(node.getNode().name);
        this.animateNodeDeletion(node, uid);
      }
    });

    // Mark as initialized after first update
    if (isInitialSetup && nodes.length > 0) {
      // Use a small timeout to ensure DOM is ready before marking as initialized
      setTimeout(() => {
        this.isInitialized = true;
      }, 100);
    }

    // Don't call layoutNodes here - we've already applied the layout
    // Only adjust camera if initial zoom hasn't been applied yet
    if (!this.initialZoomApplied) {
      this.adjustCameraForContent();
    }
  }

  private checkAndInitializeInstancedRendering(): void {
    // Enable instanced rendering for large clusters
    const podCount = this.pods.size;
    if (podCount > 100 && !this.podInstanceManager && this.useInstancedRendering) {
      console.log('[VisualizationManager] Initializing instanced rendering for', podCount, 'pods');
      this.podInstanceManager = new PodInstanceManager(this.podGroup);

      // Migrate existing pods to instanced rendering
      this.pods.forEach(pod => {
        this.podGroup.remove(pod);
        pod.dispose();
      });
      this.pods.clear();
    }
  }

  private updatePods(pods: Pod[]): void {
    // Check if we should switch to instanced rendering
    if (pods.length > 100 && !this.podInstanceManager && this.useInstancedRendering) {
      this.checkAndInitializeInstancedRendering();
    }

    // Use instanced rendering if available
    if (this.podInstanceManager) {
      this.updatePodsInstanced(pods);
      return;
    }

    // Original individual pod rendering for small clusters
    const currentPodIds = new Set(pods.map(p => p.uid));
    const podsByNode = new Map<string, Pod[]>();

    console.log('[VisualizationManager] Updating pods. Current:', this.pods.size, 'New:', pods.length);

    pods.forEach(pod => {
      const nodePods = podsByNode.get(pod.nodeName) || [];
      nodePods.push(pod);
      podsByNode.set(pod.nodeName, nodePods);
    });

    pods.forEach(podData => {
      let pod = this.pods.get(podData.uid);

      if (!pod) {
        // Calculate initial size based on current pods in node
        const node = this.nodesByName.get(podData.nodeName);
        let initialSize = 0.8;
        if (node) {
          const nodePods = podsByNode.get(podData.nodeName) || [];
          const podIndex = nodePods.findIndex(p => p.uid === podData.uid);
          // Use world space method to get proper positions
          const slotInfo = node.getPodSlotInfoWorldSpace(podIndex, nodePods.length);
          initialSize = slotInfo.size;
        }
        pod = new PodObject(podData, initialSize, this.geometryPool);
        this.pods.set(podData.uid, pod);
        this.podGroup.add(pod);
        pod.animateCreation();
      } else {
        pod.updatePod(podData);
      }

      const node = this.nodesByName.get(podData.nodeName);
      if (node) {
        const nodePods = podsByNode.get(podData.nodeName) || [];
        const podIndex = nodePods.findIndex(p => p.uid === podData.uid);
        // Use world space method - position is already in world coordinates
        const slotInfo = node.getPodSlotInfoWorldSpace(podIndex, nodePods.length);
        pod.setTargetPosition(slotInfo.position);
        pod.setSize(slotInfo.size);
      }
    });

    // Check for pods to delete
    const toDelete: string[] = [];
    this.pods.forEach((_, uid) => {
      if (!currentPodIds.has(uid)) {
        toDelete.push(uid);
      }
    });

    // Delete marked pods
    toDelete.forEach(uid => {
      const pod = this.pods.get(uid);
      if (pod) {
        pod.animateDeletion();
        setTimeout(() => {
          this.podGroup.remove(pod);
          pod.dispose();
          this.pods.delete(uid);
        }, 1000);
      }
    });
  }

  private updatePodsInstanced(pods: Pod[]): void {
    if (!this.podInstanceManager) return;

    const podsByNode = new Map<string, Pod[]>();
    pods.forEach(pod => {
      const nodePods = podsByNode.get(pod.nodeName) || [];
      nodePods.push(pod);
      podsByNode.set(pod.nodeName, nodePods);
    });

    // Prepare position calculator
    const getPositionForPod = (pod: Pod): { position: THREE.Vector3, size: number } => {
      const node = this.nodesByName.get(pod.nodeName);
      if (!node) {
        return { position: new THREE.Vector3(), size: 0.8 };
      }

      const nodePods = podsByNode.get(pod.nodeName) || [];
      const podIndex = nodePods.findIndex(p => p.uid === pod.uid);
      return node.getPodSlotInfoWorldSpace(podIndex, nodePods.length);
    };

    this.podInstanceManager.updatePods(pods, getPositionForPod);
  }



  private calculateLayout(nodeCount: number): { positions: THREE.Vector3[], scale: number } {
    // Use reference viewport for consistent sizing
    // If we haven't stored a reference viewport, calculate one at standard distance
    if (!this.referenceViewport) {
      // Calculate viewport at standard camera distance of 100 units
      const standardDistance = 100;
      const camera = this.sceneManager.getCamera();
      const vFov = (camera.fov * Math.PI) / 180;
      const height = 2 * Math.tan(vFov / 2) * standardDistance;
      const width = height * camera.aspect;
      this.referenceViewport = { width: width * 0.8, height: height * 0.8 };
    }

    const viewport = this.referenceViewport;
    const aspectRatio = viewport.width / viewport.height;

    // Calculate optimal grid dimensions
    let cols = Math.ceil(Math.sqrt(nodeCount * aspectRatio));
    let rows = Math.ceil(nodeCount / cols);

    // Ensure at least 2 columns for better layout when we have multiple nodes
    if (cols < 2 && nodeCount > 1) cols = 2;

    // Adaptive node sizing based on cluster size
    const baseNodeSize = 20; // This matches the actual geometry size in NodeObject

    // Dynamic size constraints based on node count
    let minNodeSize: number;
    let maxNodeSize: number;
    let spacingFactor: number;

    if (nodeCount <= 10) {
      // Small clusters: larger nodes with more spacing
      minNodeSize = 15;
      maxNodeSize = 40;
      spacingFactor = 0.20; // 20% spacing
    } else if (nodeCount <= 50) {
      // Medium clusters: moderate sizing
      minNodeSize = 8;
      maxNodeSize = 25;
      spacingFactor = 0.15; // 15% spacing
    } else if (nodeCount <= 200) {
      // Large clusters: smaller nodes, tighter spacing
      minNodeSize = 4;
      maxNodeSize = 15;
      spacingFactor = 0.10; // 10% spacing
    } else {
      // Very large clusters: minimum sizing for visibility
      minNodeSize = 2;
      maxNodeSize = 8;
      spacingFactor = 0.05; // 5% spacing
    }

    // Calculate optimal node size to fill viewport
    const availableWidth = viewport.width / (cols * (1 + spacingFactor));
    const availableHeight = viewport.height / (rows * (1 + spacingFactor));

    // Choose the smaller dimension to ensure everything fits
    let nodeSize = Math.min(availableWidth, availableHeight);

    // Apply size constraints
    nodeSize = Math.max(minNodeSize, Math.min(maxNodeSize, nodeSize));

    // Calculate actual spacing
    const spacing = nodeSize * (1 + spacingFactor);

    // Calculate positions for all nodes
    const positions: THREE.Vector3[] = [];
    const gridWidth = cols * spacing - nodeSize * spacingFactor;
    const gridHeight = rows * spacing - nodeSize * spacingFactor;

    for (let i = 0; i < nodeCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const x = col * spacing - gridWidth / 2 + nodeSize / 2;
      const z = row * spacing - gridHeight / 2 + nodeSize / 2;
      const y = 0; // Keep all nodes at ground level for 2D view

      positions.push(new THREE.Vector3(x, y, z));
    }

    // Calculate scale relative to base geometry size
    const scale = nodeSize / baseNodeSize;

    console.log('[VisualizationManager] Layout calculated:', {
      nodeCount,
      cols,
      rows,
      nodeSize,
      scale,
      viewport,
      gridWidth,
      gridHeight
    });

    return { positions, scale };
  }



  private animateNodeScale(node: NodeObject, targetScale: number): void {
    // Skip animation if scale is already very close
    if (Math.abs(node.scale.x - targetScale) < 0.01) {
      return;
    }

    const duration = 500;
    const startTime = Date.now();
    const startScale = node.scale.x;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeOutCubic(progress);

      const scale = startScale + (targetScale - startScale) * easedProgress;
      node.scale.setScalar(scale);

      // Update pod positions during animation
      this.updatePodsForNode(node);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final scale is exact and pods are in final position
        node.scale.setScalar(targetScale);
        this.updatePodsForNode(node);
      }
    };

    animate();
  }

  private updatePodsForNode(node: NodeObject): void {
    // Get all pods for this node
    const podsForNode: Pod[] = [];
    this.pods.forEach(pod => {
      if (pod.getPod().nodeName === node.getNode().name) {
        podsForNode.push(pod.getPod());
      }
    });

    // Update positions for pods on this node using world space method
    podsForNode.forEach((podData, index) => {
      const pod = this.pods.get(podData.uid);
      if (pod) {
        // Use world space method directly - no transforms needed
        const slotInfo = node.getPodSlotInfoWorldSpace(index, podsForNode.length);
        pod.setTargetPosition(slotInfo.position);
        pod.setSize(slotInfo.size);
      }
    });
  }

  private adjustCameraForContent(): void {
    const nodeArray = Array.from(this.nodes.values());
    if (nodeArray.length === 0) return;

    // Calculate bounding box of all nodes
    const box = new THREE.Box3();
    nodeArray.forEach(node => {
      box.expandByObject(node);
    });

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Calculate optimal camera distance to see all content with proper padding
    const maxDimension = Math.max(size.x, size.z);
    const fov = this.sceneManager.getCamera().fov * (Math.PI / 180);

    // Adjust multiplier to ensure nodes fill 80-90% of viewport
    // Using 0.65 for ~85% viewport fill
    const optimalDistance = (maxDimension * 0.65) / (2 * Math.tan(fov / 2));


    // For initial zoom, use the calculated optimal distance directly
    let targetHeight = optimalDistance;

    // Only apply min/max constraints after initial zoom
    if (this.initialZoomApplied) {
      // Adaptive camera height based on node count
      let minHeight: number;
      let maxHeight: number;

      if (nodeArray.length <= 10) {
        minHeight = 30;
        maxHeight = 150;
      } else if (nodeArray.length <= 50) {
        minHeight = 50;
        maxHeight = 300;
      } else {
        // Large clusters need more distance
        minHeight = 100;
        maxHeight = 500;
      }

      targetHeight = Math.max(minHeight, Math.min(maxHeight, optimalDistance));
    }

    // Smoothly adjust camera position
    const camera = this.sceneManager.getCamera();
    const currentHeight = camera.position.y;


    // Force adjustment on initial load, or adjust if significantly different
    if (!this.initialZoomApplied || Math.abs(currentHeight - targetHeight) > 2) {
      camera.position.set(center.x, targetHeight, center.z + 0.001);
      camera.lookAt(center.x, 0, center.z);

      // Update controls target
      this.sceneManager.getControls().target.set(center.x, 0, center.z);
      this.sceneManager.getControls().update();

      // Mark initial zoom as applied
      if (!this.initialZoomApplied) {
        this.initialZoomApplied = true;
      }
    } else {
    }
  }

  private animateNodeCreation(node: NodeObject, targetScale: number = 1): void {
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeOutCubic(progress);

      node.scale.setScalar(easedProgress * targetScale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  private animateNodeDeletion(node: NodeObject, uid: string): void {
    const duration = 1000;
    const startTime = Date.now();
    const startScale = node.scale.x;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeOutCubic(progress);

      node.scale.setScalar(startScale * (1 - easedProgress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.nodeGroup.remove(node);
        node.dispose();
        this.nodes.delete(uid);
        this.nodesByName.delete(node.getNode().name);
      }
    };

    animate();
  }

  private animateNodePosition(node: NodeObject, targetPosition: THREE.Vector3): void {
    // Skip animation if positions are already very close
    if (node.position.distanceTo(targetPosition) < 0.01) {
      return;
    }

    const duration = 2000;
    const startTime = Date.now();
    const startPosition = node.position.clone();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOutCubic(progress);

      node.position.lerpVectors(startPosition, targetPosition, easedProgress);

      // Update pod positions during node movement
      this.updatePodsForNode(node);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure final position is exact and pods are in final position
        node.position.copy(targetPosition);
        this.updatePodsForNode(node);
      }
    };

    animate();
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  public animate(): void {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;

    // Update LOD based on camera distance
    const clusterCenter = this.getClusterCenter();
    const detailLevel = this.lodManager.updateLOD(clusterCenter);

    // Update frustum for culling
    const camera = this.sceneManager.getCamera();
    this.cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.cameraMatrix);

    // Adjust visibility based on LOD
    this.updateVisibilityByLOD(detailLevel);

    // Animate only visible nodes
    const animationSpeed = this.lodManager.getAnimationSpeedMultiplier();
    this.nodes.forEach(node => {
      if (this.isInFrustum(node) && this.lodManager.shouldRenderNodeDetails()) {
        node.animate(deltaTime * animationSpeed);
      }
    });

    // Animate pods only if LOD allows
    if (this.lodManager.shouldAnimatePods()) {
      if (this.podInstanceManager) {
        this.podInstanceManager.animate(deltaTime * animationSpeed);
      } else {
        // Animate only visible pods
        this.pods.forEach(pod => {
          if (this.isInFrustum(pod)) {
            pod.animate(deltaTime * animationSpeed);
          }
        });
      }
    }

    // Log performance stats in dev mode
    if (import.meta.env.DEV && Math.random() < 0.01) { // Log occasionally
      this.logPerformanceStats();
    }
  }

  private getClusterCenter(): THREE.Vector3 {
    const center = new THREE.Vector3();
    if (this.nodes.size === 0) return center;

    this.nodes.forEach(node => {
      center.add(node.position);
    });
    center.divideScalar(this.nodes.size);
    return center;
  }

  private updateVisibilityByLOD(_level: DetailLevel): void {
    // Show/hide pods based on LOD
    const shouldRenderPods = this.lodManager.shouldRenderPods();
    this.podGroup.visible = shouldRenderPods;

    // Adjust node opacity based on LOD
    const nodeOpacity = this.lodManager.getNodeOpacity();
    this.nodes.forEach(node => {
      const mesh = node.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
      if (mesh && mesh.material instanceof THREE.MeshPhongMaterial) {
        mesh.material.opacity = nodeOpacity;
      }
    });

    // Adjust pod opacity if visible
    if (shouldRenderPods && !this.podInstanceManager) {
      const podOpacity = this.lodManager.getPodOpacity();
      this.pods.forEach(pod => {
        const mesh = pod.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
        if (mesh && mesh.material instanceof THREE.MeshPhongMaterial) {
          mesh.material.opacity = podOpacity;
        }
      });
    }
  }

  private isInFrustum(object: THREE.Object3D): boolean {
    // Simple bounding sphere check
    const sphere = new THREE.Sphere();
    const box = new THREE.Box3().setFromObject(object);
    box.getBoundingSphere(sphere);
    return this.frustum.intersectsSphere(sphere);
  }

  private logPerformanceStats(): void {
    const poolStats = this.geometryPool.getStats();
    const instanceStats = this.podInstanceManager?.getStats();

    console.log('[Performance Stats]', {
      nodes: this.nodes.size,
      pods: this.podInstanceManager ? this.podInstanceManager.getPodCount() : this.pods.size,
      geometryPool: poolStats,
      instancedRendering: instanceStats || 'disabled',
      renderer: this.sceneManager.getScene().children.length + ' scene objects',
      lod: {
        level: this.lodManager.getCurrentLevel(),
        distance: this.lodManager.getCameraDistance().toFixed(1)
      }
    });
  }

  public handleMouseMove(event: MouseEvent): void {
    // T007 FIX: Ensure mouse coordinates are updated in SceneManager
    this.sceneManager.handleMouseMove(event);

    // T001 ANALYSIS: Current hover implementation issues:
    // 1. Does not check for instanced pods (PodInstanceManager)
    // 2. Includes nodes in raycasting but nodes have raycast disabled
    // 3. No priority system for overlapping objects
    // 4. Missing integration with PodInstanceManager.getRaycasterIntersections()
    const raycaster = this.sceneManager.getRaycaster();

    // T008 FIX: Check instanced pods first if PodInstanceManager exists
    if (this.podInstanceManager) {
      const instancedPod = this.podInstanceManager.getRaycasterIntersections(raycaster);
      if (instancedPod) {
        // Show tooltip for instanced pod
        this.showTooltipForPod(instancedPod, event.clientX, event.clientY);
        return;
      }
    }

    // Check regular pods (non-instanced) and nodes
    const allObjects: THREE.Object3D[] = [
      ...Array.from(this.nodes.values()),
      ...Array.from(this.pods.values())
    ];

    const intersects = raycaster.intersectObjects(allObjects, true);

    if (intersects.length > 0) {
      // T015: Implement priority system - pods over nodes
      const prioritizedObject = this.getPriorityHoverObject(intersects);
      if (prioritizedObject) {
        this.showTooltip(prioritizedObject, event.clientX, event.clientY);
      }
    } else {
      this.hideTooltip();
    }
  }

  public handleClick(_event: MouseEvent): void {
    const raycaster = this.sceneManager.getRaycaster();

    const allObjects: THREE.Object3D[] = [
      ...Array.from(this.nodes.values()),
      ...Array.from(this.pods.values())
    ];

    const intersects = raycaster.intersectObjects(allObjects, true);

    this.clearSelection();

    if (intersects.length > 0) {
      const object = this.findParentObject(intersects[0].object);
      if (object) {
        if (object instanceof NodeObject) {
          object.setSelected(true);
        } else if (object instanceof PodObject) {
          object.setSelected(true);
        }
      }
    }
  }

  public handleDoubleClick(_event: MouseEvent): void {
    const raycaster = this.sceneManager.getRaycaster();

    const allObjects: THREE.Object3D[] = [
      ...Array.from(this.nodes.values()),
      ...Array.from(this.pods.values())
    ];

    const intersects = raycaster.intersectObjects(allObjects, true);

    if (intersects.length > 0) {
      const object = this.findParentObject(intersects[0].object);
      if (object) {
        this.sceneManager.focusOnObject(object);
      }
    }
  }

  // T015: Priority resolver for hover detection
  private getPriorityHoverObject(intersects: THREE.Intersection[]): NodeObject | PodObject | null {
    // Group intersections by parent object type
    const podIntersections: THREE.Intersection[] = [];
    const nodeIntersections: THREE.Intersection[] = [];

    for (const intersect of intersects) {
      const parent = this.findParentObject(intersect.object);
      if (parent instanceof PodObject) {
        podIntersections.push(intersect);
      } else if (parent instanceof NodeObject) {
        // Only consider nodes that are marked as hoverable
        if (intersect.object.userData?.hoverable) {
          nodeIntersections.push(intersect);
        }
      }
    }

    // Pods have priority over nodes
    if (podIntersections.length > 0) {
      return this.findParentObject(podIntersections[0].object);
    }

    // If no pods, return closest node
    if (nodeIntersections.length > 0) {
      return this.findParentObject(nodeIntersections[0].object);
    }

    return null;
  }

  private findParentObject(object: THREE.Object3D): NodeObject | PodObject | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current instanceof NodeObject || current instanceof PodObject) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private clearSelection(): void {
    this.nodes.forEach(node => node.setSelected(false));
    this.pods.forEach(pod => pod.setSelected(false));
  }

  private showTooltip(object: NodeObject | PodObject, x: number, y: number): void {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    let content = '';

    if (object instanceof NodeObject) {
      const node = object.getNode();
      content = `
        <div class="tooltip-title">Node: ${node.name}</div>
        <div class="tooltip-content">
          <div class="tooltip-row">
            <span class="tooltip-label">Status:</span>
            <span class="tooltip-value">${node.status}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Role:</span>
            <span class="tooltip-value">${node.role}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Version:</span>
            <span class="tooltip-value">${node.kubeletVersion}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">CPU:</span>
            <span class="tooltip-value">${node.capacity.cpu}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Memory:</span>
            <span class="tooltip-value">${node.capacity.memory}</span>
          </div>
        </div>
      `;
    } else if (object instanceof PodObject) {
      const pod = object.getPod();
      const containerInfo = pod.containers
        .map(c => `${c.name} (${c.state})`)
        .join(', ');
      content = `
        <div class="tooltip-title">Pod: ${pod.name}</div>
        <div class="tooltip-content">
          <div class="tooltip-row">
            <span class="tooltip-label">Namespace:</span>
            <span class="tooltip-value">${pod.namespace}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Status:</span>
            <span class="tooltip-value">${pod.status}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Node:</span>
            <span class="tooltip-value">${pod.nodeName}</span>
          </div>
          <div class="tooltip-row">
            <span class="tooltip-label">Containers:</span>
            <span class="tooltip-value">${containerInfo}</span>
          </div>
          ${pod.ip ? `
          <div class="tooltip-row">
            <span class="tooltip-label">IP:</span>
            <span class="tooltip-value">${pod.ip}</span>
          </div>` : ''}
        </div>
      `;
    }

    tooltip.innerHTML = content;
    tooltip.style.display = 'block';
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
  }

  private showTooltipForPod(pod: Pod, x: number, y: number): void {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    const containerInfo = pod.containers
      .map(c => `${c.name} (${c.state})`)
      .join(', ');

    const content = `
      <div class="tooltip-title">Pod: ${pod.name}</div>
      <div class="tooltip-content">
        <div class="tooltip-row">
          <span class="tooltip-label">Namespace:</span>
          <span class="tooltip-value">${pod.namespace}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Status:</span>
          <span class="tooltip-value">${pod.status}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Node:</span>
          <span class="tooltip-value">${pod.nodeName}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Containers:</span>
          <span class="tooltip-value">${containerInfo}</span>
        </div>
        ${pod.ip ? `
        <div class="tooltip-row">
          <span class="tooltip-label">IP:</span>
          <span class="tooltip-value">${pod.ip}</span>
        </div>` : ''}
      </div>
    `;

    tooltip.innerHTML = content;
    tooltip.style.display = 'block';
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
  }

  private hideTooltip(): void {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  }

  public dispose(): void {
    // Remove event listeners
    window.removeEventListener('resize', this.handleResize.bind(this));

    this.nodes.forEach(node => {
      this.nodeGroup.remove(node);
      node.dispose();
    });
    this.nodes.clear();
    this.nodesByName.clear();

    if (this.podInstanceManager) {
      this.podInstanceManager.dispose();
      this.podInstanceManager = null;
    } else {
      this.pods.forEach(pod => {
        this.podGroup.remove(pod);
        pod.dispose();
      });
      this.pods.clear();
    }

    this.sceneManager.removeObject(this.nodeGroup);
    this.sceneManager.removeObject(this.podGroup);
  }
}