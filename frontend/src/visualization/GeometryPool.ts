import * as THREE from "three";

export class GeometryPool {
  private static instance: GeometryPool;

  // Shared geometries
  private podGeometry: THREE.BoxGeometry;
  private podOutlineGeometry: THREE.BoxGeometry;
  private nodeGeometry: THREE.BoxGeometry;
  private nodeOutlineGeometry: THREE.BoxGeometry;

  // Material pools by color
  private podMaterials: Map<number, THREE.MeshPhongMaterial> = new Map();
  private podOutlineMaterials: Map<number, THREE.MeshBasicMaterial> = new Map();
  private nodeMaterials: Map<number, THREE.MeshPhongMaterial> = new Map();
  private nodeOutlineMaterials: Map<number, THREE.MeshBasicMaterial> = new Map();

  // Track usage for cleanup
  private materialUsageCount: Map<THREE.Material, number> = new Map();

  private constructor() {
    // Initialize shared geometries
    this.podGeometry = new THREE.BoxGeometry(0.8, 0.24, 0.8); // baseSize * 0.3 for height
    this.podOutlineGeometry = new THREE.BoxGeometry(0.85, 0.255, 0.85);
    this.nodeGeometry = new THREE.BoxGeometry(20, 0.1, 20);
    this.nodeOutlineGeometry = new THREE.BoxGeometry(20.2, 0.2, 20.2);
  }

  public static getInstance(): GeometryPool {
    if (!GeometryPool.instance) {
      GeometryPool.instance = new GeometryPool();
    }
    return GeometryPool.instance;
  }

  public getPodGeometry(): THREE.BoxGeometry {
    return this.podGeometry;
  }

  public getPodOutlineGeometry(): THREE.BoxGeometry {
    return this.podOutlineGeometry;
  }

  public getNodeGeometry(): THREE.BoxGeometry {
    return this.nodeGeometry;
  }

  public getNodeOutlineGeometry(): THREE.BoxGeometry {
    return this.nodeOutlineGeometry;
  }

  public getPodMaterial(color: number): THREE.MeshPhongMaterial {
    let material = this.podMaterials.get(color);
    if (!material) {
      material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 0.95,
        emissive: color,
        emissiveIntensity: 0.2,
      });
      this.podMaterials.set(color, material);
      this.materialUsageCount.set(material, 0);
    }

    // Increment usage count
    const count = this.materialUsageCount.get(material) || 0;
    this.materialUsageCount.set(material, count + 1);

    return material;
  }

  public getPodOutlineMaterial(color: number): THREE.MeshBasicMaterial {
    let material = this.podOutlineMaterials.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide,
      });
      this.podOutlineMaterials.set(color, material);
      this.materialUsageCount.set(material, 0);
    }

    // Increment usage count
    const count = this.materialUsageCount.get(material) || 0;
    this.materialUsageCount.set(material, count + 1);

    return material;
  }

  public getNodeMaterial(color: number): THREE.MeshPhongMaterial {
    let material = this.nodeMaterials.get(color);
    if (!material) {
      material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      this.nodeMaterials.set(color, material);
      this.materialUsageCount.set(material, 0);
    }

    // Increment usage count
    const count = this.materialUsageCount.get(material) || 0;
    this.materialUsageCount.set(material, count + 1);

    return material;
  }

  public getNodeOutlineMaterial(color: number): THREE.MeshBasicMaterial {
    let material = this.nodeOutlineMaterials.get(color);
    if (!material) {
      material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.1,
        side: THREE.BackSide,
        depthWrite: false,
      });
      this.nodeOutlineMaterials.set(color, material);
      this.materialUsageCount.set(material, 0);
    }

    // Increment usage count
    const count = this.materialUsageCount.get(material) || 0;
    this.materialUsageCount.set(material, count + 1);

    return material;
  }

  public releaseMaterial(material: THREE.Material): void {
    const count = this.materialUsageCount.get(material);
    if (count !== undefined && count > 0) {
      this.materialUsageCount.set(material, count - 1);

      // If no longer used, we could dispose it, but we'll keep it cached
      // for potential reuse to avoid recreation overhead
    }
  }

  public getStats(): { geometries: number; materials: number; activeMaterials: number } {
    let activeMaterials = 0;
    this.materialUsageCount.forEach((count) => {
      if (count > 0) activeMaterials++;
    });

    return {
      geometries: 4, // We always have 4 shared geometries
      materials:
        this.podMaterials.size +
        this.podOutlineMaterials.size +
        this.nodeMaterials.size +
        this.nodeOutlineMaterials.size,
      activeMaterials,
    };
  }

  public dispose(): void {
    // Dispose all geometries
    this.podGeometry.dispose();
    this.podOutlineGeometry.dispose();
    this.nodeGeometry.dispose();
    this.nodeOutlineGeometry.dispose();

    // Dispose all materials
    this.podMaterials.forEach((material) => material.dispose());
    this.podOutlineMaterials.forEach((material) => material.dispose());
    this.nodeMaterials.forEach((material) => material.dispose());
    this.nodeOutlineMaterials.forEach((material) => material.dispose());

    // Clear maps
    this.podMaterials.clear();
    this.podOutlineMaterials.clear();
    this.nodeMaterials.clear();
    this.nodeOutlineMaterials.clear();
    this.materialUsageCount.clear();
  }
}
