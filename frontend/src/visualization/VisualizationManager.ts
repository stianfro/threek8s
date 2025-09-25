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

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;

    this.nodeGroup = new THREE.Group();
    this.nodeGroup.name = 'nodes';
    this.sceneManager.addObject(this.nodeGroup);

    this.podGroup = new THREE.Group();
    this.podGroup.name = 'pods';
    this.sceneManager.addObject(this.podGroup);
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

    // Reset node scale for recalculation
    this.nodeScale = 1;

    nodes.forEach((nodeData, index) => {
      let node = this.nodes.get(nodeData.uid);

      if (!node) {
        console.log('[VisualizationManager] Creating new node:', nodeData.name);
        node = new NodeObject(nodeData);
        this.nodes.set(nodeData.uid, node);
        this.nodesByName.set(nodeData.name, node);
        this.nodeGroup.add(node);

        const position = this.calculateNodePosition(index, nodes.length);
        node.position.copy(position);

        node.scale.set(0, 0, 0);
        this.animateNodeCreation(node);
      } else {
        node.updateNode(nodeData);
      }
    });

    this.nodes.forEach((node, uid) => {
      if (!currentNodeIds.has(uid)) {
        this.nodesByName.delete(node.getNode().name);
        this.animateNodeDeletion(node, uid);
      }
    });

    this.layoutNodes();
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
          const slotInfo = node.getPodSlotInfo(podIndex, nodePods.length);
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
        const slotInfo = node.getPodSlotInfo(podIndex, nodePods.length);
        const worldPosition = node.position.clone().add(slotInfo.position);
        pod.setTargetPosition(worldPosition);
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

  private calculateNodePosition(index: number, total: number): THREE.Vector3 {
    // Dynamic grid layout that scales with node count
    // Calculate optimal grid dimensions based on aspect ratio
    const aspectRatio = 16 / 9; // Typical screen aspect ratio

    // Calculate grid dimensions
    let cols = Math.ceil(Math.sqrt(total * aspectRatio));
    let rows = Math.ceil(total / cols);

    // Ensure at least 2 columns for better layout
    if (cols < 2 && total > 1) cols = 2;

    // Calculate dynamic spacing based on viewport constraints
    const maxViewportWidth = 80;  // Maximum width to use
    const maxViewportHeight = 45;  // Maximum height to use

    // Base node size (will be scaled down if needed)
    const baseNodeSize = 20;
    const minSpacing = 2; // Minimum spacing between nodes

    // Calculate spacing to fit all nodes in viewport
    const requiredWidth = cols * baseNodeSize + (cols - 1) * minSpacing;
    const requiredHeight = rows * baseNodeSize + (rows - 1) * minSpacing;

    // Calculate scale factor if content exceeds viewport
    const scaleX = requiredWidth > maxViewportWidth ? maxViewportWidth / requiredWidth : 1;
    const scaleZ = requiredHeight > maxViewportHeight ? maxViewportHeight / requiredHeight : 1;
    const scale = Math.min(scaleX, scaleZ);

    // Apply scaling
    const nodeSize = baseNodeSize * scale;
    const spacing = nodeSize + minSpacing * scale;

    // Calculate position
    const row = Math.floor(index / cols);
    const col = index % cols;

    // Center the layout
    const totalWidth = cols * nodeSize + (cols - 1) * minSpacing * scale;
    const totalDepth = rows * nodeSize + (rows - 1) * minSpacing * scale;

    const x = col * spacing - totalWidth / 2 + nodeSize / 2;
    const z = row * spacing - totalDepth / 2 + nodeSize / 2;
    const y = 0; // Keep all nodes at ground level for 2D view

    // Store the calculated scale for node sizing
    if (!this.nodeScale) {
      this.nodeScale = scale;
    }

    return new THREE.Vector3(x, y, z);
  }

  private nodeScale: number = 1;

  private layoutNodes(): void {
    const nodeArray = Array.from(this.nodes.values());
    const total = nodeArray.length;

    // Recalculate positions with proper scaling
    this.nodeScale = 1; // Reset before calculation

    nodeArray.forEach((node, index) => {
      const targetPosition = this.calculateNodePosition(index, total);
      this.animateNodePosition(node, targetPosition);

      // Apply dynamic scaling to node
      const targetScale = this.nodeScale;
      this.animateNodeScale(node, targetScale);
    });
  }

  private animateNodeScale(node: NodeObject, targetScale: number): void {
    const duration = 500;
    const startTime = Date.now();
    const startScale = node.scale.x;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeOutCubic(progress);

      const scale = startScale + (targetScale - startScale) * easedProgress;
      node.scale.setScalar(scale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
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

    // Adjust camera position to fit all content
    const maxDimension = Math.max(size.x, size.z);
    const fov = this.sceneManager.getCamera().fov * (Math.PI / 180);
    const cameraZ = Math.abs(maxDimension / 2 / Math.tan(fov / 2));

    // Set camera to look at center and position it appropriately
    const targetHeight = Math.max(100, cameraZ * 1.5); // Minimum 100 units up
    this.sceneManager.getCamera().position.set(center.x, targetHeight, center.z + 0.001);
    this.sceneManager.getCamera().lookAt(center.x, 0, center.z);

    // Update controls target
    this.sceneManager.getControls().target.set(center.x, 0, center.z);
    this.sceneManager.getControls().update();
  }

  private animateNodeCreation(node: NodeObject): void {
    const targetScale = 1;
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
    const duration = 2000;
    const startTime = Date.now();
    const startPosition = node.position.clone();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOutCubic(progress);

      node.position.lerpVectors(startPosition, targetPosition, easedProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
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