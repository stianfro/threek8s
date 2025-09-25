import * as THREE from 'three';
import type { KubernetesNode } from '../types/kubernetes';

export class NodeObject extends THREE.Group {
  private node: KubernetesNode;
  private mesh: THREE.Mesh;
  private outline: THREE.Mesh;
  private labelSprite?: THREE.Sprite;
  private selected: boolean = false;

  constructor(node: KubernetesNode) {
    super();
    this.node = node;

    // Flat square for 2D view
    const size = 20;
    const thickness = 0.5; // Very thin for flat appearance

    const geometry = new THREE.BoxGeometry(size, thickness, size);

    const color = this.getNodeColor();
    // More transparent material to see pods inside
    const material = new THREE.MeshPhongMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false
    });

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
    const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    // Make edges ignore raycasting too
    edges.raycast = () => {};
    this.add(edges);

    const outlineGeometry = new THREE.BoxGeometry(size + 0.2, thickness + 0.1, size + 0.2);
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
      depthWrite: false
    });
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

  public getPodSlotInfo(index: number, totalPods: number): { position: THREE.Vector3, size: number } {
    // Calculate grid dimensions based on node size
    const nodeSize = 20;
    const nodeHeight = 0.5;
    const margin = 1; // Small margin from edge
    const availableSpace = nodeSize - (2 * margin);

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

    // Position pods to fill the entire node area
    const x = -availableSpace/2 + spacingX/2 + col * spacingX;
    const y = nodeHeight / 2 + actualPodSize / 2 + 0.5; // Place pods slightly above node surface
    const z = -availableSpace/2 + spacingZ/2 + row * spacingZ;

    return {
      position: new THREE.Vector3(x, y, z),
      size: actualPodSize
    };
  }

  public dispose(): void {
    if (this.mesh.geometry) this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) this.mesh.material.dispose();

    if (this.outline.geometry) this.outline.geometry.dispose();
    if (this.outline.material instanceof THREE.Material) this.outline.material.dispose();

    if (this.labelSprite) {
      if (this.labelSprite.material instanceof THREE.Material) {
        this.labelSprite.material.dispose();
      }
    }
  }
}