import * as THREE from "three";
import type { Pod } from "../types/kubernetes";
import { GeometryPool } from "./GeometryPool";

export class PodObject extends THREE.Group {
  private pod: Pod;
  private mesh: THREE.Mesh;
  private outline: THREE.Mesh;
  private selected: boolean = false;
  private targetPosition: THREE.Vector3 = new THREE.Vector3();
  private targetScale: number = 1;
  private baseSize: number = 0.8;
  private geometryPool: GeometryPool | null;

  constructor(pod: Pod, initialSize?: number, geometryPool?: GeometryPool) {
    super();
    this.pod = pod;
    this.geometryPool = geometryPool || null;

    const size = initialSize || this.baseSize;
    this.baseSize = size;

    const color = this.getPodColor();

    // Use pooled resources if available
    if (this.geometryPool) {
      const geometry = this.geometryPool.getPodGeometry();
      const material = this.geometryPool.getPodMaterial(color);

      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.add(this.mesh);

      const outlineGeometry = this.geometryPool.getPodOutlineGeometry();
      const outlineMaterial = this.geometryPool.getPodOutlineMaterial(color);
      this.outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
      this.add(this.outline);
    } else {
      // Fallback to creating new geometries/materials
      const geometry = new THREE.BoxGeometry(size, size * 0.3, size);
      const material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 0.95,
        emissive: color,
        emissiveIntensity: 0.2,
      });

      this.mesh = new THREE.Mesh(geometry, material);
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
      this.add(this.mesh);

      const outlineGeometry = new THREE.BoxGeometry(size + 0.05, size * 0.3 + 0.05, size + 0.05);
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide,
      });
      this.outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
      this.add(this.outline);
    }

    this.userData = {
      type: "pod",
      data: pod,
    };

    this.name = `pod-${pod.namespace}-${pod.name}`;
  }

  private getPodColor(): number {
    switch (this.pod.status) {
      case "Running":
        return 0x2196f3; // Blue
      case "Pending":
        return 0xffc107; // Yellow
      case "Succeeded":
        return 0x4caf50; // Green
      case "Failed":
        return 0xf44336; // Red
      case "Unknown":
        return 0x9e9e9e; // Gray
      case "Terminating":
        return 0xff9800; // Orange
      case "ContainerCreating":
        return 0x00bcd4; // Cyan
      case "CrashLoopBackOff":
        return 0xe91e63; // Pink
      case "ImagePullBackOff":
        return 0x9c27b0; // Purple
      case "ErrImagePull":
        return 0x673ab7; // Deep Purple
      case "CreateContainerError":
        return 0x795548; // Brown
      default:
        return 0x607d8b; // Blue-gray
    }
  }

  public updatePod(pod: Pod): void {
    this.pod = pod;
    this.userData.data = pod;

    const color = this.getPodColor();
    if (this.mesh.material instanceof THREE.MeshPhongMaterial) {
      this.mesh.material.color.setHex(color);
      this.mesh.material.emissive.setHex(color);
    }
    if (this.outline.material instanceof THREE.MeshBasicMaterial) {
      this.outline.material.color.setHex(color);
    }

    if (pod.status === "Terminating") {
      this.targetScale = 0;
    }
  }

  public setSelected(selected: boolean): void {
    this.selected = selected;
    if (this.outline.material instanceof THREE.MeshBasicMaterial) {
      this.outline.material.opacity = selected ? 0.5 : 0.2;
    }
    if (this.mesh.material instanceof THREE.MeshPhongMaterial) {
      this.mesh.material.emissiveIntensity = selected ? 0.3 : 0.1;
    }
  }

  public isSelected(): boolean {
    return this.selected;
  }

  public getPod(): Pod {
    return this.pod;
  }

  public setTargetPosition(position: THREE.Vector3): void {
    this.targetPosition.copy(position);
  }

  public setSize(newSize: number): void {
    const scale = newSize / this.baseSize;
    this.targetScale = scale;
  }

  public animate(deltaTime: number): void {
    if (!this.position.equals(this.targetPosition)) {
      this.position.lerp(this.targetPosition, deltaTime * 5);
    }

    const currentScale = this.scale.x;
    if (Math.abs(currentScale - this.targetScale) > 0.001) {
      const newScale = THREE.MathUtils.lerp(currentScale, this.targetScale, deltaTime * 8); // Faster scaling
      this.scale.set(newScale, newScale, newScale);

      if (newScale < 0.01 && this.targetScale === 0) {
        this.visible = false;
      }
    }

    if (this.selected || this.pod.status === "Pending") {
      this.mesh.rotation.y += deltaTime * 1.5;
    }

    if (this.pod.status === "CrashLoopBackOff" || this.pod.status === "Failed") {
      const shake = Math.sin(Date.now() * 0.01) * 0.05;
      this.position.x += shake;
    }
  }

  public animateCreation(): void {
    this.scale.set(0, 0, 0);
    this.targetScale = 1.5; // Start bigger
    this.visible = true;

    // After initial growth, scale back to normal
    setTimeout(() => {
      this.targetScale = 1;
    }, 500);

    // Add a bright flash effect on creation
    if (this.mesh.material instanceof THREE.MeshPhongMaterial) {
      const material = this.mesh.material as THREE.MeshPhongMaterial;
      const originalIntensity = (material as any).emissiveIntensity || 0;
      (material as any).emissiveIntensity = 1.0;
      setTimeout(() => {
        (material as any).emissiveIntensity = originalIntensity;
      }, 300);
    }
  }

  public animateDeletion(): void {
    this.targetScale = 0;

    // Add red flash effect on deletion
    if (this.mesh.material instanceof THREE.MeshPhongMaterial) {
      this.mesh.material.emissive.setHex(0xff0000);
      this.mesh.material.emissiveIntensity = 0.8;
    }
  }

  public dispose(): void {
    // Release materials to pool if using pooled resources
    if (this.geometryPool) {
      if (this.mesh.material instanceof THREE.Material) {
        this.geometryPool.releaseMaterial(this.mesh.material);
      }
      if (this.outline.material instanceof THREE.Material) {
        this.geometryPool.releaseMaterial(this.outline.material);
      }
      // Don't dispose pooled geometries
    } else {
      // Dispose individual resources if not pooled
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material instanceof THREE.Material) this.mesh.material.dispose();

      if (this.outline.geometry) this.outline.geometry.dispose();
      if (this.outline.material instanceof THREE.Material) this.outline.material.dispose();
    }
  }
}
