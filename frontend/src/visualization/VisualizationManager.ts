import * as THREE from 'three';
import { SceneManager } from '../scene/SceneManager';
import { NodeObject } from './NodeObject';
import { PodObject } from './PodObject';
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

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;

    this.nodeGroup = new THREE.Group();
    this.nodeGroup.name = 'nodes';
    this.sceneManager.addObject(this.nodeGroup);

    this.podGroup = new THREE.Group();
    this.podGroup.name = 'pods';
    this.sceneManager.addObject(this.podGroup);

    // Add resize handler for dynamic viewport updates
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private handleResize = (): void => {
    // Skip resize handling during initial setup to prevent double animations
    if (!this.isInitialized) {
      return;
    }

    // Recalculate layout and update all nodes
    if (this.nodes.size > 0) {
      const nodeCount = this.nodes.size;
      const layout = this.calculateLayout(nodeCount);

      // Only animate if layout actually changed significantly
      if (this.hasLayoutChanged(layout)) {
        // Update node positions using the same layout calculation
        let index = 0;
        this.nodes.forEach((node) => {
          this.animateNodePosition(node, layout.positions[index]);
          this.animateNodeScale(node, layout.scale);
          index++;
        });

        this.lastLayout = layout;
        this.adjustCameraForContent();
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

    // Calculate the complete layout first
    const layout = this.calculateLayout(nodes.length);
    this.lastLayout = layout;

    // Track if this is initial setup
    const isInitialSetup = this.nodes.size === 0;

    nodes.forEach((nodeData, index) => {
      let node = this.nodes.get(nodeData.uid);

      if (!node) {
        console.log('[VisualizationManager] Creating new node:', nodeData.name);
        node = new NodeObject(nodeData);
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
        // Only animate if not initial setup
        if (!isInitialSetup) {
          // Update existing node position and scale with animation
          this.animateNodePosition(node, layout.positions[index]);
          this.animateNodeScale(node, layout.scale);
        } else {
          // Initial setup - set positions immediately without animation
          node.position.copy(layout.positions[index]);
          node.scale.setScalar(layout.scale);
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
    this.adjustCameraForContent();
  }

  private updatePods(pods: Pod[]): void {
    const currentPodIds = new Set(pods.map(p => p.uid));
    const podsByNode = new Map<string, Pod[]>();

    console.log('[VisualizationManager] Updating pods. Current:', this.pods.size, 'New:', pods.length);
    console.log('[VisualizationManager] Current pod UIDs:', Array.from(this.pods.keys()));
    console.log('[VisualizationManager] New pod UIDs:', Array.from(currentPodIds));

    pods.forEach(pod => {
      const nodePods = podsByNode.get(pod.nodeName) || [];
      nodePods.push(pod);
      podsByNode.set(pod.nodeName, nodePods);
    });

    pods.forEach(podData => {
      let pod = this.pods.get(podData.uid);

      if (!pod) {
        console.log('[VisualizationManager] Creating new pod:', podData.name, podData.status);
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
        pod = new PodObject(podData, initialSize);
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
    this.pods.forEach((pod, uid) => {
      if (!currentPodIds.has(uid)) {
        console.log('[VisualizationManager] Marking pod for deletion:', uid, pod.getPod().name);
        toDelete.push(uid);
      }
    });

    // Delete marked pods
    toDelete.forEach(uid => {
      const pod = this.pods.get(uid);
      if (pod) {
        console.log('[VisualizationManager] Animating deletion for pod:', pod.getPod().name);
        pod.animateDeletion();
        setTimeout(() => {
          console.log('[VisualizationManager] Removing pod from scene:', uid);
          this.podGroup.remove(pod);
          pod.dispose();
          this.pods.delete(uid);
        }, 1000);
      }
    });
  }

  private calculateVisibleArea(): { width: number; height: number } {
    const camera = this.sceneManager.getCamera();
    const distance = camera.position.y; // Top-down view
    const vFov = (camera.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * distance;
    const width = height * camera.aspect;
    return { width: width * 0.8, height: height * 0.8 }; // Use 80% of visible area for margins
  }


  private calculateLayout(nodeCount: number): { positions: THREE.Vector3[], scale: number } {
    // Get actual visible viewport area
    const viewport = this.calculateVisibleArea();
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

    // Calculate optimal camera distance to see all content with some padding
    const maxDimension = Math.max(size.x, size.z);
    const fov = this.sceneManager.getCamera().fov * (Math.PI / 180);
    const optimalDistance = (maxDimension * 1.2) / (2 * Math.tan(fov / 2));

    // Adaptive camera height based on node count
    let minHeight: number;
    let maxHeight: number;

    if (nodeArray.length <= 10) {
      minHeight = 50;
      maxHeight = 150;
    } else if (nodeArray.length <= 50) {
      minHeight = 80;
      maxHeight = 300;
    } else {
      // Large clusters need more distance
      minHeight = 100;
      maxHeight = 500;
    }

    const targetHeight = Math.max(minHeight, Math.min(maxHeight, optimalDistance));

    // Smoothly adjust camera position
    const camera = this.sceneManager.getCamera();
    const currentHeight = camera.position.y;

    // Only adjust if significantly different (avoid minor adjustments)
    if (Math.abs(currentHeight - targetHeight) > 5) {
      camera.position.set(center.x, targetHeight, center.z + 0.001);
      camera.lookAt(center.x, 0, center.z);

      // Update controls target
      this.sceneManager.getControls().target.set(center.x, 0, center.z);
      this.sceneManager.getControls().update();
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

    this.nodes.forEach(node => node.animate(deltaTime));
    this.pods.forEach(pod => pod.animate(deltaTime));
  }

  public handleMouseMove(event: MouseEvent): void {
    const raycaster = this.sceneManager.getRaycaster();

    const allObjects: THREE.Object3D[] = [
      ...Array.from(this.nodes.values()),
      ...Array.from(this.pods.values())
    ];

    const intersects = raycaster.intersectObjects(allObjects, true);

    if (intersects.length > 0) {
      const object = this.findParentObject(intersects[0].object);
      if (object) {
        this.showTooltip(object, event.clientX, event.clientY);
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

    this.pods.forEach(pod => {
      this.podGroup.remove(pod);
      pod.dispose();
    });
    this.pods.clear();

    this.sceneManager.removeObject(this.nodeGroup);
    this.sceneManager.removeObject(this.podGroup);
  }
}