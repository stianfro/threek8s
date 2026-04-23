import * as THREE from "three";

// Process-lifetime cache of geometries and materials keyed by color. Materials are
// shared between node instances so disposing one would break the others; they are
// released only in dispose(). Pods do not use this pool - PodInstanceManager owns
// its own InstancedMesh materials.
export class GeometryPool {
  private static instance: GeometryPool;

  private nodeGeometry: THREE.BoxGeometry;
  private nodeOutlineGeometry: THREE.BoxGeometry;

  private nodeMaterials: Map<number, THREE.MeshPhongMaterial> = new Map();
  private nodeOutlineMaterials: Map<number, THREE.MeshBasicMaterial> = new Map();

  private constructor() {
    this.nodeGeometry = new THREE.BoxGeometry(20, 0.1, 20);
    this.nodeOutlineGeometry = new THREE.BoxGeometry(20.2, 0.2, 20.2);
  }

  public static getInstance(): GeometryPool {
    if (!GeometryPool.instance) {
      GeometryPool.instance = new GeometryPool();
    }
    return GeometryPool.instance;
  }

  public getNodeGeometry(): THREE.BoxGeometry {
    return this.nodeGeometry;
  }

  public getNodeOutlineGeometry(): THREE.BoxGeometry {
    return this.nodeOutlineGeometry;
  }

  public getNodeMaterial(color: number): THREE.MeshPhongMaterial {
    let material = this.nodeMaterials.get(color);
    if (!material) {
      material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.nodeMaterials.set(color, material);
    }
    return material;
  }

  public getNodeOutlineMaterial(color: number): THREE.MeshBasicMaterial {
    let material = this.nodeOutlineMaterials.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
        depthWrite: false,
      });
      this.nodeOutlineMaterials.set(color, material);
    }
    return material;
  }

  public getStats(): { geometries: number; materials: number } {
    return {
      geometries: 2,
      materials: this.nodeMaterials.size + this.nodeOutlineMaterials.size,
    };
  }

  public dispose(): void {
    this.nodeGeometry.dispose();
    this.nodeOutlineGeometry.dispose();
    this.nodeMaterials.forEach((m) => m.dispose());
    this.nodeOutlineMaterials.forEach((m) => m.dispose());
    this.nodeMaterials.clear();
    this.nodeOutlineMaterials.clear();
  }
}
