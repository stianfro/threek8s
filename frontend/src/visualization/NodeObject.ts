import * as THREE from "three";
import type { KubernetesNode } from "../types/kubernetes";
import { GeometryPool } from "./GeometryPool";

export class NodeObject extends THREE.Group {
  private node: KubernetesNode;
  private mesh: THREE.Mesh;
  private outline: THREE.Mesh;
  private edges: THREE.LineSegments;
  private labelSprite?: THREE.Sprite;
  private selected: boolean = false;
  private geometryPool: GeometryPool;

  constructor(node: KubernetesNode, geometryPool?: GeometryPool) {
    super();
    this.node = node;
    this.geometryPool = geometryPool || GeometryPool.getInstance();

    const color = this.getNodeColor();

    // Use pooled resources
    const geometry = this.geometryPool.getNodeGeometry();
    const material = this.geometryPool.getNodeMaterial(color);

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    // T012 FIX: Re-enable raycasting for nodes
    // Use userData to identify as hoverable node with lower priority than pods
    this.mesh.userData.hoverable = true;
    this.mesh.userData.type = "node";
    this.mesh.userData.nodeData = node;
    this.mesh.renderOrder = -1;
    this.add(this.mesh);

    // Create wireframe edges for better visibility
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.8,
    });
    this.edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    // Keep edges non-hoverable to avoid interference
    this.edges.raycast = () => {};
    this.add(this.edges);

    const outlineGeometry = this.geometryPool.getNodeOutlineGeometry();
    const outlineMaterial = this.geometryPool.getNodeOutlineMaterial(color);
    this.outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    // Keep outline non-hoverable to avoid interference
    this.outline.raycast = () => {};
    this.add(this.outline);

    this.userData = {
      type: "node",
      data: node,
    };

    this.name = `node-${node.name}`;
  }

  private getNodeColor(): number {
    switch (this.node.status) {
      case "Ready":
        return 0x4caf50; // Green
      case "NotReady":
        return 0xff9800; // Orange
      case "Unknown":
        return 0x9e9e9e; // Gray
      default:
        return 0x607d8b; // Blue-gray
    }
  }

  public updateNode(node: KubernetesNode): void {
    this.node = node;
    this.userData.data = node;

    const color = this.getNodeColor();
    if (this.mesh.material instanceof THREE.MeshPhongMaterial) {
      this.mesh.material.color.setHex(color);
    }
    if (this.outline.material instanceof THREE.MeshBasicMaterial) {
      this.outline.material.color.setHex(color);
    }
  }

  public setSelected(selected: boolean): void {
    this.selected = selected;
    if (this.outline.material instanceof THREE.MeshBasicMaterial) {
      this.outline.material.opacity = selected ? 0.6 : 0.3;
    }
  }

  public isSelected(): boolean {
    return this.selected;
  }

  public getNode(): KubernetesNode {
    return this.node;
  }

  // T013: Add tooltip data provider for nodes
  public getTooltipData(): {
    type: string;
    name: string;
    status: string;
    role: string;
    capacity: { cpu: string; memory: string; pods: string };
    allocatable: { cpu: string; memory: string; pods: string };
    podCount: number;
    zone: string;
  } {
    const node = this.node;
    const podCount = this.children.filter(
      (child) =>
        child.userData?.type === "pod" ||
        (child instanceof THREE.Object3D && child.userData?.type === "pod"),
    ).length;

    return {
      type: "node",
      name: node.name,
      status: node.status,
      role: node.role || "worker",
      capacity: {
        cpu: node.capacity?.cpu || "N/A",
        memory: node.capacity?.memory || "N/A",
        pods: node.capacity?.pods || "110",
      },
      allocatable: {
        cpu: node.allocatable?.cpu || "N/A",
        memory: node.allocatable?.memory || "N/A",
        pods: node.allocatable?.pods || "110",
      },
      podCount: podCount,
      zone: node.zone || "N/A",
    };
  }

  public animate(deltaTime: number): void {
    if (this.selected) {
      this.outline.rotation.y += deltaTime * 0.5;
    }
  }

  // Cached per-frame grid: totalPods changes only when a pod is added/removed and
  // scale only when the zone layout changes. Recomputing on every pod call was the
  // O(n²) hot spot in updatePodsForNode.
  private cachedGrid: {
    totalPods: number;
    scaleKey: number;
    cols: number;
    cellSize: number;
    availableSpace: number;
    podSize: number;
    localY: number;
  } | null = null;

  public getPodSlotInfoWorldSpace(
    index: number,
    totalPods: number,
  ): { position: THREE.Vector3; size: number } {
    const scaleKey = Math.round(this.scale.x * 1000);
    let grid = this.cachedGrid;
    if (!grid || grid.totalPods !== totalPods || grid.scaleKey !== scaleKey) {
      const baseNodeSize = 20;
      const actualNodeSize = baseNodeSize * this.scale.x;
      const nodeHeight = 0.1 * this.scale.x;
      const margin = 2.0 * this.scale.x;
      const availableSpace = actualNodeSize - 2 * margin;
      const cols = Math.ceil(Math.sqrt(totalPods));
      const rows = Math.ceil(totalPods / cols);
      const cellSize = Math.min(availableSpace / cols, availableSpace / rows);
      const maxPodSize = 2.5 * this.scale.x;
      const minPodSize = 0.1 * this.scale.x;
      const podSize = Math.max(minPodSize, Math.min(maxPodSize, cellSize * 0.85));
      const localY = nodeHeight / 2 + (podSize * 0.3) / 2;
      grid = { totalPods, scaleKey, cols, cellSize, availableSpace, podSize, localY };
      this.cachedGrid = grid;
    }

    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    const start = -grid.availableSpace / 2;
    const localX = start + grid.cellSize * (col + 0.5);
    const localZ = start + grid.cellSize * (row + 0.5);

    return {
      position: new THREE.Vector3(
        this.position.x + localX,
        this.position.y + grid.localY,
        this.position.z + localZ,
      ),
      size: grid.podSize,
    };
  }

  public dispose(): void {
    // Node mesh/outline materials are shared by color via GeometryPool; don't
    // dispose them here - GeometryPool.dispose() handles them.
    if (this.edges) {
      this.edges.geometry.dispose();
      if (this.edges.material instanceof THREE.Material) {
        this.edges.material.dispose();
      }
    }
    if (this.labelSprite && this.labelSprite.material instanceof THREE.Material) {
      this.labelSprite.material.dispose();
    }
  }
}
