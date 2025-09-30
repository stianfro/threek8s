import * as THREE from 'three';
import { SceneManager } from '../scene/SceneManager';
import { NodeObject } from './NodeObject';
import { PodObject } from './PodObject';
import { PodInstanceManager } from './PodInstanceManager';
import { GeometryPool } from './GeometryPool';
import { LODManager, DetailLevel } from './LODManager';
import { ZoneManager } from './ZoneManager';
import type { ZoneLayout } from './ZoneManager';
import type { KubernetesNode, Pod, ClusterState } from '../types/kubernetes';

export class VisualizationManager {
  private sceneManager: SceneManager;
  private nodes: Map<string, NodeObject> = new Map();
  private nodesByName: Map<string, NodeObject> = new Map();
  private pods: Map<string, PodObject> = new Map();
  private nodeGroup: THREE.Group;
  private podGroup: THREE.Group;
  private zoneBordersGroup: THREE.Group;
  private zoneLabelsGroup: THREE.Group;
  private lastUpdateTime: number = Date.now();
  private isInitialized: boolean = false;
  private lastLayout: ZoneLayout | null = null;
  private initialZoomApplied: boolean = false;
  private layoutLocked: boolean = false;
  private referenceViewport: { width: number; height: number } | null = null;
  private podInstanceManager: PodInstanceManager | null = null;
  private useInstancedRendering: boolean = true;
  private geometryPool: GeometryPool;
  private frustum: THREE.Frustum = new THREE.Frustum();
  private cameraMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private lodManager: LODManager;
  private zoneManager: ZoneManager | null = null;

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

    this.zoneBordersGroup = new THREE.Group();
    this.zoneBordersGroup.name = 'zoneBorders';
    this.sceneManager.addObject(this.zoneBordersGroup);

    this.zoneLabelsGroup = new THREE.Group();
    this.zoneLabelsGroup.name = 'zoneLabels';
    this.sceneManager.addObject(this.zoneLabelsGroup);

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

      // Initialize zone manager if needed
      if (!this.zoneManager) {
        this.initializeZoneManager();
      }

      const nodesArray = Array.from(this.nodes.values()).map(n => n.getNode());
      const layout = this.zoneManager!.calculateZoneLayout(nodesArray);

      // Check if the layout has changed significantly
      if (this.hasLayoutChanged(layout)) {
        // Update node positions using the new layout
        this.applyZoneLayout(layout);

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

  private hasLayoutChanged(newLayout: ZoneLayout): boolean {
    if (!this.lastLayout) return true;

    // Check if zone count changed
    if (this.lastLayout.zones.length !== newLayout.zones.length) return true;

    // Check if any zone's position or size changed significantly
    for (let i = 0; i < newLayout.zones.length; i++) {
      const oldZone = this.lastLayout.zones[i];
      const newZone = newLayout.zones[i];

      if (!oldZone) return true;

      // Check zone position
      if (oldZone.position.distanceTo(newZone.position) > 0.1) return true;

      // Check zone size
      if (Math.abs(oldZone.size.width - newZone.size.width) > 0.1) return true;
      if (Math.abs(oldZone.size.height - newZone.size.height) > 0.1) return true;

      // Check node scale
      if (Math.abs(oldZone.nodeScale - newZone.nodeScale) > 0.01) return true;
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

  private initializeZoneManager(): void {
    // Use reference viewport for consistent sizing
    if (!this.referenceViewport) {
      const standardDistance = 100;
      const camera = this.sceneManager.getCamera();
      const vFov = (camera.fov * Math.PI) / 180;
      const height = 2 * Math.tan(vFov / 2) * standardDistance;
      const width = height * camera.aspect;
      this.referenceViewport = { width: width * 0.8, height: height * 0.8 };
    }

    this.zoneManager = new ZoneManager(this.referenceViewport);
  }

  private applyZoneLayout(layout: ZoneLayout): void {
    // Create a map of node UID to its position and scale in the zone layout
    const nodePositionMap = new Map<string, { position: THREE.Vector3; scale: number }>();

    layout.zones.forEach(zone => {
      zone.nodes.forEach((nodeData, index) => {
        nodePositionMap.set(nodeData.uid, {
          position: zone.nodePositions[index],
          scale: zone.nodeScale
        });
      });
    });

    // Apply positions and scales to all nodes
    this.nodes.forEach((nodeObj, uid) => {
      const layoutInfo = nodePositionMap.get(uid);
      if (layoutInfo) {
        this.animateNodePosition(nodeObj, layoutInfo.position);
        this.animateNodeScale(nodeObj, layoutInfo.scale);
      }
    });

    // Update zone borders
    this.updateZoneBorders(layout);
  }

  private createZoneLabel(zoneName: string, position: THREE.Vector3): THREE.Sprite {
    // Create canvas for text rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    // No background fill - transparent background

    // Style and draw text
    context.font = 'bold 28px Arial, sans-serif';
    context.fillStyle = 'white';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillText(zoneName, 12, 14);

    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false // Render on top
    });

    const sprite = new THREE.Sprite(material);

    // Scale sprite appropriately (adjust based on scene scale)
    sprite.scale.set(12, 3, 1);
    sprite.position.copy(position);
    sprite.renderOrder = 1000; // Render above everything else

    // Disable raycasting so labels don't interfere with hover
    sprite.raycast = () => {};

    return sprite;
  }

  private updateZoneBorders(layout: ZoneLayout): void {
    // Clear existing borders and labels
    this.zoneBordersGroup.clear();
    this.zoneLabelsGroup.clear();

    // Create border and label for each zone
    layout.zones.forEach(zone => {
      const halfWidth = zone.size.width / 2;
      const halfHeight = zone.size.height / 2;

      // Create rectangle border
      const points: THREE.Vector3[] = [
        new THREE.Vector3(zone.position.x - halfWidth, 0, zone.position.z - halfHeight),
        new THREE.Vector3(zone.position.x + halfWidth, 0, zone.position.z - halfHeight),
        new THREE.Vector3(zone.position.x + halfWidth, 0, zone.position.z + halfHeight),
        new THREE.Vector3(zone.position.x - halfWidth, 0, zone.position.z + halfHeight),
        new THREE.Vector3(zone.position.x - halfWidth, 0, zone.position.z - halfHeight), // Close the loop
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x808080, // Gray color
        linewidth: 1,
        transparent: true,
        opacity: 0.5
      });

      const border = new THREE.Line(geometry, material);
      border.renderOrder = -1; // Render behind other objects
      border.raycast = () => {}; // Disable raycasting so it doesn't interfere with hover

      this.zoneBordersGroup.add(border);

      // Create zone label above the zone border (outside the content area)
      // Position label with offset accounting for label size
      const labelOffsetX = 6; // Horizontal offset to align with left border
      const labelOffsetZ = 2; // Vertical offset - position above but close to the top border
      const labelPosition = new THREE.Vector3(
        zone.position.x - halfWidth + labelOffsetX,
        0.5, // Slightly above ground
        zone.position.z - halfHeight - labelOffsetZ // Negative to position ABOVE the zone
      );

      const label = this.createZoneLabel(zone.zoneName, labelPosition);
      this.zoneLabelsGroup.add(label);
    });
  }

  private updateNodes(nodes: KubernetesNode[]): void {
    const currentNodeIds = new Set(nodes.map(n => n.uid));

    // Track if this is initial setup
    const isInitialSetup = this.nodes.size === 0;

    // Check if node count has changed
    const nodeCountChanged = this.nodes.size !== nodes.length;

    // Initialize zone manager if needed
    if (!this.zoneManager) {
      this.initializeZoneManager();
    }

    // Only recalculate layout if it's initial setup, node count changed, or layout isn't locked
    let layout = this.lastLayout;
    if (!layout || isInitialSetup || (nodeCountChanged && !this.layoutLocked)) {
      if (!this.zoneManager) {
        console.error('[VisualizationManager] ZoneManager not initialized');
        return;
      }
      layout = this.zoneManager.calculateZoneLayout(nodes);
      this.lastLayout = layout;

      // Update zone borders when layout changes
      this.updateZoneBorders(layout);

      // Lock layout after initial setup
      if (isInitialSetup && nodes.length > 0) {
        this.layoutLocked = true;
      }
    }

    // Create a map of node UID to its position and scale in the zone layout
    const nodePositionMap = new Map<string, { position: THREE.Vector3; scale: number }>();
    layout.zones.forEach(zone => {
      zone.nodes.forEach((nodeData, index) => {
        nodePositionMap.set(nodeData.uid, {
          position: zone.nodePositions[index],
          scale: zone.nodeScale
        });
      });
    });

    nodes.forEach((nodeData) => {
      let node = this.nodes.get(nodeData.uid);
      const layoutInfo = nodePositionMap.get(nodeData.uid);

      if (!layoutInfo) {
        console.error('[VisualizationManager] No layout info for node:', nodeData.name);
        return;
      }

      if (!node) {
        console.log('[VisualizationManager] Creating new node:', nodeData.name);
        node = new NodeObject(nodeData, this.geometryPool);
        this.nodes.set(nodeData.uid, node);
        this.nodesByName.set(nodeData.name, node);
        this.nodeGroup.add(node);

        // Set the final position and scale immediately
        node.position.copy(layoutInfo.position);
        node.scale.setScalar(layoutInfo.scale);

        // Only animate if not initial setup
        if (!isInitialSetup) {
          // For new nodes after initial setup, start from scale 0
          node.scale.set(0, 0, 0);
          this.animateNodeCreation(node, layoutInfo.scale);
        }
      } else {
        node.updateNode(nodeData);
        // Only animate if layout has actually changed
        const scaleChanged = Math.abs(node.scale.x - layoutInfo.scale) > 0.01;
        const positionChanged = node.position.distanceTo(layoutInfo.position) > 0.1;

        if (scaleChanged || positionChanged) {
          if (positionChanged) {
            this.animateNodePosition(node, layoutInfo.position);
          }
          if (scaleChanged) {
            this.animateNodeScale(node, layoutInfo.scale);
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
        return;
      }
    }

    // Check for zone hover if no object was hit
    if (this.zoneManager && this.lastLayout) {
      const worldPoint = this.getWorldPointFromMouse(raycaster);
      if (worldPoint) {
        const zone = this.zoneManager.findZoneAtPosition(worldPoint, this.lastLayout);
        if (zone) {
          this.showZoneTooltip(zone.zoneName, zone.nodes, event.clientX, event.clientY);
          return;
        }
      }
    }

    this.hideTooltip();
  }

  private getWorldPointFromMouse(raycaster: THREE.Raycaster): THREE.Vector3 | null {
    // Create a plane at y=0 (ground level) to intersect with raycaster
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    return target;
  }

  public handleClick(_event: MouseEvent): void {
    // Removed click behavior: no longer spins nodes or changes colors
  }

  public handleDoubleClick(_event: MouseEvent): void {
    // Removed double-click zoom behavior
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

  private showZoneTooltip(zoneName: string, nodes: KubernetesNode[], x: number, y: number): void {
    const tooltip = document.getElementById('tooltip');
    if (!tooltip) return;

    if (!this.zoneManager) return;

    const zoneInfo = this.zoneManager.getZoneInfo(zoneName, nodes);

    const content = `
      <div class="tooltip-title">Zone: ${zoneInfo.name}</div>
      <div class="tooltip-content">
        <div class="tooltip-row">
          <span class="tooltip-label">Nodes:</span>
          <span class="tooltip-value">${zoneInfo.nodeCount} (${zoneInfo.readyNodes} ready)</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Total CPU:</span>
          <span class="tooltip-value">${zoneInfo.totalCpu}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Total Memory:</span>
          <span class="tooltip-value">${zoneInfo.totalMemory}</span>
        </div>
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

    // Clear zone borders and labels
    // Dispose label sprites and textures
    this.zoneLabelsGroup.children.forEach(child => {
      if (child instanceof THREE.Sprite) {
        if (child.material.map) {
          child.material.map.dispose();
        }
        child.material.dispose();
      }
    });
    this.zoneLabelsGroup.clear();
    this.zoneBordersGroup.clear();

    this.sceneManager.removeObject(this.nodeGroup);
    this.sceneManager.removeObject(this.podGroup);
    this.sceneManager.removeObject(this.zoneBordersGroup);
    this.sceneManager.removeObject(this.zoneLabelsGroup);
  }
}