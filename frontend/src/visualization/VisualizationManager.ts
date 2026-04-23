import * as THREE from "three";
import { SceneManager } from "../scene/SceneManager";
import { NodeObject } from "./NodeObject";
import { PodInstanceManager } from "./PodInstanceManager";
import { GeometryPool } from "./GeometryPool";
import { LODManager } from "./LODManager";
import { ZoneManager } from "./ZoneManager";
import type { ZoneLayout } from "./ZoneManager";
import type { KubernetesNode, Pod, ClusterState } from "../types/kubernetes";

// One InstancedMesh per pod status scales to 13k+ pods. Individual meshes don't.
export class VisualizationManager {
  private sceneManager: SceneManager;
  private nodes: Map<string, NodeObject> = new Map();
  private nodesByName: Map<string, NodeObject> = new Map();

  private nodeGroup: THREE.Group;
  private podGroup: THREE.Group;
  private zoneBordersGroup: THREE.Group;
  private zoneLabelsGroup: THREE.Group;

  private zoneLabels: Map<string, THREE.Sprite> = new Map();

  private lastUpdateTime: number = Date.now();
  private lastLayout: ZoneLayout | null = null;
  private initialCameraFitDone: boolean = false;
  private referenceViewport: { width: number; height: number } | null = null;

  private podInstanceManager: PodInstanceManager;
  private geometryPool: GeometryPool;
  private frustum: THREE.Frustum = new THREE.Frustum();
  private cameraMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private lodManager: LODManager;
  private zoneManager: ZoneManager | null = null;

  // Per-state caches rebuilt once per applyState; reused during node animations.
  private lastPods: Pod[] = [];
  private podsByNode: Map<string, Pod[]> = new Map();

  // RAF-coalescing: WebSocket events mark the state dirty; the animation loop
  // applies at most one state per frame, never re-entering layout mid-frame.
  private pendingState: ClusterState | null = null;

  constructor(sceneManager: SceneManager) {
    this.sceneManager = sceneManager;
    this.geometryPool = GeometryPool.getInstance();
    this.lodManager = new LODManager(this.sceneManager.getCamera());

    this.nodeGroup = new THREE.Group();
    this.nodeGroup.name = "nodes";
    this.sceneManager.addObject(this.nodeGroup);

    this.podGroup = new THREE.Group();
    this.podGroup.name = "pods";
    this.sceneManager.addObject(this.podGroup);

    this.zoneBordersGroup = new THREE.Group();
    this.zoneBordersGroup.name = "zoneBorders";
    this.sceneManager.addObject(this.zoneBordersGroup);

    this.zoneLabelsGroup = new THREE.Group();
    this.zoneLabelsGroup.name = "zoneLabels";
    this.sceneManager.addObject(this.zoneLabelsGroup);

    this.podInstanceManager = new PodInstanceManager(this.podGroup);

    window.addEventListener("resize", this.handleResize);
  }

  public queueStateUpdate(state: ClusterState): void {
    this.pendingState = state;
  }

  public updateState(state: ClusterState): void {
    this.pendingState = null;
    this.applyState(state);
  }

  private applyState(state: ClusterState): void {
    this.updateNodes(state.nodes);
    this.updatePods(state.pods);
  }

  private handleResize = (): void => {
    if (this.nodes.size === 0) return;

    this.referenceViewport = null;
    if (!this.zoneManager) {
      this.initializeZoneManager();
    }
    if (!this.zoneManager) return;

    const nodesArray = Array.from(this.nodes.values()).map((n) => n.getNode());
    const layout = this.zoneManager.calculateZoneLayout(nodesArray);

    if (!this.hasLayoutChanged(layout)) return;

    this.applyZoneLayout(layout);
    this.lastLayout = layout;
    this.adjustCameraForContent();
    if (this.lastPods.length > 0) this.updatePodInstances();
  };

  private hasLayoutChanged(newLayout: ZoneLayout): boolean {
    if (!this.lastLayout) return true;
    if (this.lastLayout.zones.length !== newLayout.zones.length) return true;

    for (let i = 0; i < newLayout.zones.length; i++) {
      const oldZone = this.lastLayout.zones[i];
      const newZone = newLayout.zones[i];
      if (!oldZone || !newZone) return true;
      if (oldZone.position.distanceTo(newZone.position) > 0.1) return true;
      if (Math.abs(oldZone.size.width - newZone.size.width) > 0.1) return true;
      if (Math.abs(oldZone.size.height - newZone.size.height) > 0.1) return true;
      if (Math.abs(oldZone.nodeScale - newZone.nodeScale) > 0.01) return true;
    }
    return false;
  }

  private initializeZoneManager(): void {
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
    const positionMap = this.buildPositionMap(layout);
    this.nodes.forEach((nodeObj, uid) => {
      const info = positionMap.get(uid);
      if (!info) return;
      this.animateNodePosition(nodeObj, info.position);
      this.animateNodeScale(nodeObj, info.scale);
    });
    this.updateZoneBorders(layout);
  }

  private buildPositionMap(
    layout: ZoneLayout,
  ): Map<string, { position: THREE.Vector3; scale: number }> {
    const map = new Map<string, { position: THREE.Vector3; scale: number }>();
    layout.zones.forEach((zone) => {
      zone.nodes.forEach((n, i) => {
        const p = zone.nodePositions[i];
        if (p) map.set(n.uid, { position: p, scale: zone.nodeScale });
      });
    });
    return map;
  }

  private updateZoneBorders(layout: ZoneLayout): void {
    this.zoneBordersGroup.clear();
    const currentZoneNames = new Set<string>();

    layout.zones.forEach((zone) => {
      currentZoneNames.add(zone.zoneName);
      const halfWidth = zone.size.width / 2;
      const halfHeight = zone.size.height / 2;

      const points: THREE.Vector3[] = [
        new THREE.Vector3(zone.position.x - halfWidth, 0, zone.position.z - halfHeight),
        new THREE.Vector3(zone.position.x + halfWidth, 0, zone.position.z - halfHeight),
        new THREE.Vector3(zone.position.x + halfWidth, 0, zone.position.z + halfHeight),
        new THREE.Vector3(zone.position.x - halfWidth, 0, zone.position.z + halfHeight),
        new THREE.Vector3(zone.position.x - halfWidth, 0, zone.position.z - halfHeight),
      ];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x808080,
        transparent: true,
        opacity: 0.5,
      });
      const border = new THREE.Line(geometry, material);
      border.renderOrder = -1;
      border.raycast = () => {};
      this.zoneBordersGroup.add(border);

      const labelPosition = new THREE.Vector3(
        zone.position.x - halfWidth + 6,
        0.5,
        zone.position.z - halfHeight - 2,
      );
      let label = this.zoneLabels.get(zone.zoneName);
      if (!label) {
        label = this.createZoneLabel(zone.zoneName);
        this.zoneLabels.set(zone.zoneName, label);
        this.zoneLabelsGroup.add(label);
      }
      label.position.copy(labelPosition);
    });

    // Dispose labels whose zones disappeared. Canvas textures and SpriteMaterials
    // must be disposed explicitly or they leak GPU memory.
    for (const [name, sprite] of this.zoneLabels) {
      if (currentZoneNames.has(name)) continue;
      this.zoneLabelsGroup.remove(sprite);
      this.disposeZoneLabel(sprite);
      this.zoneLabels.delete(name);
    }
  }

  private createZoneLabel(zoneName: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "bold 28px Arial, sans-serif";
      ctx.fillStyle = "white";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(zoneName, 12, 14);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(12, 3, 1);
    sprite.renderOrder = 1000;
    sprite.raycast = () => {};
    return sprite;
  }

  private disposeZoneLabel(sprite: THREE.Sprite): void {
    const material = sprite.material;
    if (material.map) material.map.dispose();
    material.dispose();
  }

  private updateNodes(nodes: KubernetesNode[]): void {
    const currentNodeIds = new Set(nodes.map((n) => n.uid));
    const isInitialSetup = this.nodes.size === 0;
    const nodeCountChanged = this.nodes.size !== nodes.length;

    if (!this.zoneManager) {
      this.initializeZoneManager();
    }
    if (!this.zoneManager) return;

    let layout = this.lastLayout;
    if (!layout || isInitialSetup || nodeCountChanged) {
      layout = this.zoneManager.calculateZoneLayout(nodes);
      this.lastLayout = layout;
      this.updateZoneBorders(layout);
    }

    const positionMap = this.buildPositionMap(layout);

    nodes.forEach((nodeData) => {
      let node = this.nodes.get(nodeData.uid);
      const info = positionMap.get(nodeData.uid);
      if (!info) {
        console.error("[VisualizationManager] No layout info for node:", nodeData.name);
        return;
      }

      if (!node) {
        node = new NodeObject(nodeData, this.geometryPool);
        this.nodes.set(nodeData.uid, node);
        this.nodesByName.set(nodeData.name, node);
        this.nodeGroup.add(node);
        node.position.copy(info.position);
        node.scale.setScalar(info.scale);
        if (!isInitialSetup) {
          node.scale.set(0, 0, 0);
          this.animateNodeCreation(node, info.scale);
        }
      } else {
        node.updateNode(nodeData);
        const scaleChanged = Math.abs(node.scale.x - info.scale) > 0.01;
        const positionChanged = node.position.distanceTo(info.position) > 0.1;
        if (positionChanged) this.animateNodePosition(node, info.position);
        if (scaleChanged) this.animateNodeScale(node, info.scale);
      }
    });

    this.nodes.forEach((node, uid) => {
      if (currentNodeIds.has(uid)) return;
      this.nodesByName.delete(node.getNode().name);
      this.animateNodeDeletion(node, uid);
    });

    // Exactly one camera fit, as soon as there is something to fit. Previous code
    // used a 100ms setTimeout race that ran before nodes were positioned.
    if (!this.initialCameraFitDone && nodes.length > 0) {
      this.adjustCameraForContent();
      this.initialCameraFitDone = true;
    }
  }

  private updatePods(pods: Pod[]): void {
    this.lastPods = pods;
    this.rebuildPodsByNode();
    this.updatePodInstances();
  }

  private rebuildPodsByNode(): void {
    this.podsByNode.clear();
    for (const pod of this.lastPods) {
      let arr = this.podsByNode.get(pod.nodeName);
      if (!arr) {
        arr = [];
        this.podsByNode.set(pod.nodeName, arr);
      }
      arr.push(pod);
    }
  }

  private updatePodInstances(): void {
    this.podInstanceManager.updatePods(this.lastPods, (pod) => {
      const node = this.nodesByName.get(pod.nodeName);
      const nodePods = this.podsByNode.get(pod.nodeName);
      if (!node || !nodePods) {
        return { position: new THREE.Vector3(), size: 0.8 };
      }
      const index = nodePods.indexOf(pod);
      return node.getPodSlotInfoWorldSpace(index < 0 ? 0 : index, nodePods.length);
    });
  }

  private animateNodeScale(node: NodeObject, targetScale: number): void {
    if (Math.abs(node.scale.x - targetScale) < 0.01) return;

    const duration = 500;
    const startTime = Date.now();
    const startScale = node.scale.x;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = this.easeOutCubic(progress);
      node.scale.setScalar(startScale + (targetScale - startScale) * eased);
      this.updatePodInstances();
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        node.scale.setScalar(targetScale);
        this.updatePodInstances();
      }
    };
    animate();
  }

  private adjustCameraForContent(): void {
    const nodeArray = Array.from(this.nodes.values());
    if (nodeArray.length === 0) return;

    const box = new THREE.Box3();
    nodeArray.forEach((node) => box.expandByObject(node));

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.z);
    const camera = this.sceneManager.getCamera();
    const fov = camera.fov * (Math.PI / 180);
    const optimalDistance = (maxDimension * 0.65) / (2 * Math.tan(fov / 2));

    let targetHeight = optimalDistance;
    if (this.initialCameraFitDone) {
      let minHeight: number;
      let maxHeight: number;
      if (nodeArray.length <= 10) {
        minHeight = 30;
        maxHeight = 150;
      } else if (nodeArray.length <= 50) {
        minHeight = 50;
        maxHeight = 300;
      } else {
        minHeight = 100;
        maxHeight = 500;
      }
      targetHeight = Math.max(minHeight, Math.min(maxHeight, optimalDistance));
    }

    const currentHeight = camera.position.y;
    if (!this.initialCameraFitDone || Math.abs(currentHeight - targetHeight) > 2) {
      camera.position.set(center.x, targetHeight, center.z + 0.001);
      camera.lookAt(center.x, 0, center.z);
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
      const eased = this.easeOutCubic(progress);
      node.scale.setScalar(eased * targetScale);
      if (progress < 1) requestAnimationFrame(animate);
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
      const eased = this.easeOutCubic(progress);
      node.scale.setScalar(startScale * (1 - eased));
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
    if (node.position.distanceTo(targetPosition) < 0.01) return;

    const duration = 2000;
    const startTime = Date.now();
    const startPosition = node.position.clone();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = this.easeInOutCubic(progress);
      node.position.lerpVectors(startPosition, targetPosition, eased);
      this.updatePodInstances();
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        node.position.copy(targetPosition);
        this.updatePodInstances();
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
    if (this.pendingState) {
      const state = this.pendingState;
      this.pendingState = null;
      this.applyState(state);
    }

    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;

    const clusterCenter = this.getClusterCenter();
    this.lodManager.updateLOD(clusterCenter);

    const camera = this.sceneManager.getCamera();
    this.cameraMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.cameraMatrix);

    this.updateVisibilityByLOD();

    const animationSpeed = this.lodManager.getAnimationSpeedMultiplier();
    this.nodes.forEach((node) => {
      if (this.lodManager.shouldRenderNodeDetails() && this.isInFrustum(node)) {
        node.animate(deltaTime * animationSpeed);
      }
    });

    if (this.lodManager.shouldAnimatePods()) {
      this.podInstanceManager.animate(deltaTime * animationSpeed);
    }

    if (import.meta.env.DEV && Math.random() < 0.01) {
      this.logPerformanceStats();
    }
  }

  private getClusterCenter(): THREE.Vector3 {
    const center = new THREE.Vector3();
    if (this.nodes.size === 0) return center;
    this.nodes.forEach((node) => center.add(node.position));
    center.divideScalar(this.nodes.size);
    return center;
  }

  private updateVisibilityByLOD(): void {
    this.podGroup.visible = this.lodManager.shouldRenderPods();
    const nodeOpacity = this.lodManager.getNodeOpacity();
    this.nodes.forEach((node) => {
      const mesh = node.children.find((child) => child instanceof THREE.Mesh) as
        | THREE.Mesh
        | undefined;
      if (mesh && mesh.material instanceof THREE.MeshPhongMaterial) {
        mesh.material.opacity = nodeOpacity;
      }
    });
  }

  private isInFrustum(object: THREE.Object3D): boolean {
    const sphere = new THREE.Sphere();
    const box = new THREE.Box3().setFromObject(object);
    box.getBoundingSphere(sphere);
    return this.frustum.intersectsSphere(sphere);
  }

  private logPerformanceStats(): void {
    console.log("[Performance Stats]", {
      nodes: this.nodes.size,
      pods: this.podInstanceManager.getPodCount(),
      geometryPool: this.geometryPool.getStats(),
      instanced: this.podInstanceManager.getStats(),
      lod: {
        level: this.lodManager.getCurrentLevel(),
        distance: this.lodManager.getCameraDistance().toFixed(1),
      },
    });
  }

  public handleMouseMove(event: MouseEvent): void {
    this.sceneManager.handleMouseMove(event);
    const raycaster = this.sceneManager.getRaycaster();

    const instancedPod = this.podInstanceManager.getRaycasterIntersections(raycaster);
    if (instancedPod) {
      this.showTooltipForPod(instancedPod, event.clientX, event.clientY);
      return;
    }

    const nodeIntersects = raycaster.intersectObjects(Array.from(this.nodes.values()), true);
    for (const intersect of nodeIntersects) {
      if (!intersect.object.userData?.hoverable) continue;
      const parent = this.findParentNode(intersect.object);
      if (parent) {
        this.showTooltipForNode(parent, event.clientX, event.clientY);
        return;
      }
    }

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
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, target);
    return target;
  }

  private findParentNode(object: THREE.Object3D): NodeObject | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current instanceof NodeObject) return current;
      current = current.parent;
    }
    return null;
  }

  private showTooltipForNode(object: NodeObject, x: number, y: number): void {
    const tooltip = document.getElementById("tooltip");
    if (!tooltip) return;

    const node = object.getNode();
    tooltip.innerHTML = `
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
    tooltip.style.display = "block";
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
  }

  private showTooltipForPod(pod: Pod, x: number, y: number): void {
    const tooltip = document.getElementById("tooltip");
    if (!tooltip) return;

    const containerInfo = pod.containers.map((c) => `${c.name} (${c.state})`).join(", ");
    tooltip.innerHTML = `
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
        ${
          pod.ip
            ? `
        <div class="tooltip-row">
          <span class="tooltip-label">IP:</span>
          <span class="tooltip-value">${pod.ip}</span>
        </div>`
            : ""
        }
      </div>
    `;
    tooltip.style.display = "block";
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
  }

  private showZoneTooltip(zoneName: string, nodes: KubernetesNode[], x: number, y: number): void {
    const tooltip = document.getElementById("tooltip");
    if (!tooltip || !this.zoneManager) return;

    const zoneInfo = this.zoneManager.getZoneInfo(zoneName, nodes);
    tooltip.innerHTML = `
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
    tooltip.style.display = "block";
    tooltip.style.left = `${x + 10}px`;
    tooltip.style.top = `${y + 10}px`;
  }

  private hideTooltip(): void {
    const tooltip = document.getElementById("tooltip");
    if (tooltip) tooltip.style.display = "none";
  }

  public dispose(): void {
    window.removeEventListener("resize", this.handleResize);

    this.nodes.forEach((node) => {
      this.nodeGroup.remove(node);
      node.dispose();
    });
    this.nodes.clear();
    this.nodesByName.clear();

    this.podInstanceManager.dispose();

    this.zoneLabels.forEach((sprite) => {
      this.zoneLabelsGroup.remove(sprite);
      this.disposeZoneLabel(sprite);
    });
    this.zoneLabels.clear();
    this.zoneLabelsGroup.clear();
    this.zoneBordersGroup.clear();

    this.sceneManager.removeObject(this.nodeGroup);
    this.sceneManager.removeObject(this.podGroup);
    this.sceneManager.removeObject(this.zoneBordersGroup);
    this.sceneManager.removeObject(this.zoneLabelsGroup);
  }
}
