import * as THREE from 'three';
import type { KubernetesNode } from '../types/kubernetes';
import { GeometryPool } from './GeometryPool';

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
    // Make node mesh completely ignore raycasting so pods inside can be hovered
    this.mesh.raycast = () => {};
    this.mesh.renderOrder = -1;
    this.add(this.mesh);

    // Create wireframe edges for better visibility
    const edgesGeometry = new THREE.EdgesGeometry(geometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
      color: color,
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });
    this.edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    // Make edges ignore raycasting too
    this.edges.raycast = () => {};
    this.add(this.edges);

    const outlineGeometry = this.geometryPool.getNodeOutlineGeometry();
    const outlineMaterial = this.geometryPool.getNodeOutlineMaterial(color);
    this.outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    // Make outline ignore raycasting
    this.outline.raycast = () => {};
    this.add(this.outline);

    this.userData = {
      type: 'node',
      data: node
    };

    this.name = `node-${node.name}`;
  }

  private getNodeColor(): number {
    switch (this.node.status) {
      case 'Ready':
        return 0x4CAF50; // Green
      case 'NotReady':
        return 0xFF9800; // Orange
      case 'Unknown':
        return 0x9E9E9E; // Gray
      default:
        return 0x607D8B; // Blue-gray
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

  public animate(deltaTime: number): void {
    if (this.selected) {
      this.outline.rotation.y += deltaTime * 0.5;
    }
  }

  public getPodSlotPosition(index: number, totalPods: number): THREE.Vector3 {
    const { position } = this.getPodSlotInfo(index, totalPods);
    return position;
  }

  public getPodSlotInfoWorldSpace(index: number, totalPods: number): { position: THREE.Vector3, size: number } {
    // Calculate pod positions in world space directly
    // This accounts for the node's current position and scale

    const baseNodeSize = 20;
    const actualNodeSize = baseNodeSize * this.scale.x; // Get actual world size
    const nodeHeight = 0.1 * this.scale.x; // Match the flatter node thickness

    // Simple margin calculation
    const margin = 2.0 * this.scale.x; // Margin from node edges
    const availableSpace = actualNodeSize - (2 * margin);

    // Calculate optimal grid layout
    const cols = Math.ceil(Math.sqrt(totalPods));
    const rows = Math.ceil(totalPods / cols);

    // Simple pod size calculation - fill available space
    const cellWidth = availableSpace / cols;
    const cellHeight = availableSpace / rows;
    const cellSize = Math.min(cellWidth, cellHeight);

    // Pod size is 85% of cell size to leave gaps
    let podSize = cellSize * 0.85;

    // Apply min/max constraints based on scale
    const maxPodSize = 2.5 * this.scale.x;
    const minPodSize = 0.1 * this.scale.x;
    podSize = Math.max(minPodSize, Math.min(maxPodSize, podSize));

    // Calculate position for this specific pod
    const col = index % cols;
    const row = Math.floor(index / cols);

    // Simple grid positioning - start from top-left of available space
    const startX = -availableSpace / 2;
    const startZ = -availableSpace / 2;

    // Position in center of each cell
    const localX = startX + cellWidth * (col + 0.5);
    const localZ = startZ + cellHeight * (row + 0.5);

    // Place pods directly on top of the flat node surface
    // Pod height is 0.3 * podSize (flatter pods)
    const podHeight = podSize * 0.3;
    const localY = nodeHeight / 2 + podHeight / 2; // Position based on actual pod height

    // Add node's world position to get final world position
    const worldPosition = new THREE.Vector3(
      this.position.x + localX,
      this.position.y + localY,
      this.position.z + localZ
    );

    return {
      position: worldPosition,
      size: podSize
    };
  }

  public getPodSlotInfo(index: number, totalPods: number, nodeScale: number = 1): { position: THREE.Vector3, size: number } {
    // Keep the old method for backwards compatibility
    // Calculate grid dimensions based on BASE node size (geometry size)
    const baseNodeSize = 20;
    const nodeHeight = 0.1; // Match the flatter node thickness
    const margin = 1; // Margin in local space
    const availableSpace = baseNodeSize - (2 * margin);

    // Calculate optimal grid layout
    const cols = Math.ceil(Math.sqrt(totalPods));
    const rows = Math.ceil(totalPods / cols);

    // Calculate pod size based on available space
    // Pods should scale to fill the available space
    const podSpaceX = availableSpace / cols;
    const podSpaceZ = availableSpace / rows;
    const maxPodSize = Math.min(podSpaceX, podSpaceZ) * 0.85; // 85% of cell size for spacing

    // Limit pod size to reasonable bounds
    const podSize = Math.min(maxPodSize, 2.5); // Max size of 2.5
    const actualPodSize = Math.max(podSize, 0.4); // Min size of 0.4

    // Calculate actual spacing based on pod size
    const spacingX = availableSpace / cols;
    const spacingZ = availableSpace / rows;

    const col = index % cols;
    const row = Math.floor(index / cols);

    // Position pods to fill the entire node area (in local node space)
    const x = -availableSpace/2 + spacingX/2 + col * spacingX;
    // Pod height is 0.3 * actualPodSize (flatter pods)
    const podHeight = actualPodSize * 0.3;
    const y = nodeHeight / 2 + podHeight / 2; // Place pods directly on node surface
    const z = -availableSpace/2 + spacingZ/2 + row * spacingZ;

    return {
      position: new THREE.Vector3(x, y, z),
      size: actualPodSize * nodeScale // Scale the pod size by the node's scale
    };
  }

  public dispose(): void {
    // Release materials back to pool
    if (this.mesh.material instanceof THREE.Material) {
      this.geometryPool.releaseMaterial(this.mesh.material);
    }

    if (this.outline.material instanceof THREE.Material) {
      this.geometryPool.releaseMaterial(this.outline.material);
    }

    // Dispose edges geometry and material (not pooled)
    if (this.edges) {
      if (this.edges.geometry) this.edges.geometry.dispose();
      if (this.edges.material instanceof THREE.Material) {
        this.edges.material.dispose();
      }
    }

    // Dispose label sprite if it exists
    if (this.labelSprite) {
      if (this.labelSprite.material instanceof THREE.Material) {
        this.labelSprite.material.dispose();
      }
    }

    // Don't dispose pooled geometries
  }
}