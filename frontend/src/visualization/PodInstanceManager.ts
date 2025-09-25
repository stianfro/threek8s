import * as THREE from 'three';
import type { Pod } from '../types/kubernetes';

interface PodInstance {
  pod: Pod;
  index: number;
  targetPosition: THREE.Vector3;
  currentPosition: THREE.Vector3;
  targetScale: number;
  currentScale: number;
  animationProgress: number;
  isNew: boolean;
  isDeleting: boolean;
}

export class PodInstanceManager {
  private static readonly MAX_INSTANCES = 10000;
  private static readonly POD_STATUSES = [
    'Running', 'Pending', 'Succeeded', 'Failed', 'Unknown',
    'Terminating', 'ContainerCreating', 'CrashLoopBackOff',
    'ImagePullBackOff', 'ErrImagePull', 'CreateContainerError'
  ];

  private instancedMeshes: Map<string, THREE.InstancedMesh> = new Map();
  private podInstances: Map<string, PodInstance> = new Map();
  private statusGroups: Map<string, Set<string>> = new Map();

  // Reusable objects to avoid allocations
  private tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private tempPosition: THREE.Vector3 = new THREE.Vector3();
  private tempQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private tempScale: THREE.Vector3 = new THREE.Vector3();
  private tempColor: THREE.Color = new THREE.Color();

  // Animation settings
  private animationSpeed = 5;
  private scaleSpeed = 8;

  constructor(private parent: THREE.Object3D) {
    this.initializeInstancedMeshes();
  }

  private initializeInstancedMeshes(): void {
    const geometry = new THREE.BoxGeometry(0.8, 0.24, 0.8);

    PodInstanceManager.POD_STATUSES.forEach(status => {
      const color = this.getStatusColor(status);
      const material = new THREE.MeshPhongMaterial({
        color: color,
        transparent: true,
        opacity: 0.95,
        emissive: color,
        emissiveIntensity: 0.2
      });

      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        PodInstanceManager.MAX_INSTANCES
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0; // Start with no instances visible
      mesh.frustumCulled = true;

      this.instancedMeshes.set(status, mesh);
      this.statusGroups.set(status, new Set());
      this.parent.add(mesh);
    });
  }

  private getStatusColor(status: string): number {
    const colors: Record<string, number> = {
      'Running': 0x2196F3,
      'Pending': 0xFFC107,
      'Succeeded': 0x4CAF50,
      'Failed': 0xF44336,
      'Unknown': 0x9E9E9E,
      'Terminating': 0xFF9800,
      'ContainerCreating': 0x00BCD4,
      'CrashLoopBackOff': 0xE91E63,
      'ImagePullBackOff': 0x9C27B0,
      'ErrImagePull': 0x673AB7,
      'CreateContainerError': 0x795548
    };
    return colors[status] || 0x607D8B;
  }

  public updatePods(pods: Pod[], getPositionForPod: (pod: Pod) => { position: THREE.Vector3, size: number }): void {
    const currentPodIds = new Set(pods.map(p => p.uid));

    // Mark pods for deletion
    this.podInstances.forEach((instance, uid) => {
      if (!currentPodIds.has(uid)) {
        instance.isDeleting = true;
        instance.targetScale = 0;
      }
    });

    // Update or create pod instances
    pods.forEach(podData => {
      let instance = this.podInstances.get(podData.uid);
      const positionInfo = getPositionForPod(podData);

      if (!instance) {
        // Create new instance
        const statusGroup = this.statusGroups.get(podData.status);
        if (!statusGroup) return;

        instance = {
          pod: podData,
          index: statusGroup.size,
          targetPosition: positionInfo.position.clone(),
          currentPosition: positionInfo.position.clone(),
          targetScale: positionInfo.size,
          currentScale: 0,
          animationProgress: 0,
          isNew: true,
          isDeleting: false
        };

        statusGroup.add(podData.uid);
        this.podInstances.set(podData.uid, instance);
      } else {
        // Update existing instance
        if (instance.pod.status !== podData.status) {
          // Status changed, move to different instanced mesh
          const oldGroup = this.statusGroups.get(instance.pod.status);
          const newGroup = this.statusGroups.get(podData.status);

          if (oldGroup && newGroup) {
            oldGroup.delete(podData.uid);
            instance.index = newGroup.size;
            newGroup.add(podData.uid);
          }
        }

        instance.pod = podData;
        instance.targetPosition.copy(positionInfo.position);
        instance.targetScale = positionInfo.size;
      }
    });

    // Update instance counts and rebuild matrices
    this.updateInstanceMatrices();
  }

  private updateInstanceMatrices(): void {
    // Reset all counts
    this.instancedMeshes.forEach(mesh => {
      mesh.count = 0;
    });

    // Group instances by status and update matrices
    const statusIndices: Map<string, number> = new Map();
    PodInstanceManager.POD_STATUSES.forEach(status => {
      statusIndices.set(status, 0);
    });

    this.podInstances.forEach(instance => {
      const mesh = this.instancedMeshes.get(instance.pod.status);
      if (!mesh) return;

      const index = statusIndices.get(instance.pod.status) || 0;

      // Build transformation matrix
      this.tempPosition.copy(instance.currentPosition);
      this.tempScale.setScalar(instance.currentScale);
      this.tempQuaternion.identity();

      // Add rotation for pending pods
      if (instance.pod.status === 'Pending') {
        this.tempQuaternion.setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          Date.now() * 0.001
        );
      }

      this.tempMatrix.compose(this.tempPosition, this.tempQuaternion, this.tempScale);
      mesh.setMatrixAt(index, this.tempMatrix);

      // Update color intensity for selected/animated pods
      if (instance.isNew) {
        this.tempColor.setHex(0xFFFFFF);
      } else {
        this.tempColor.setHex(this.getStatusColor(instance.pod.status));
      }
      mesh.setColorAt(index, this.tempColor);

      statusIndices.set(instance.pod.status, index + 1);
      mesh.count = index + 1;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    });
  }

  public animate(deltaTime: number): void {
    let needsUpdate = false;
    const toDelete: string[] = [];

    this.podInstances.forEach((instance, uid) => {
      let changed = false;

      // Animate position
      if (!instance.currentPosition.equals(instance.targetPosition)) {
        instance.currentPosition.lerp(instance.targetPosition, deltaTime * this.animationSpeed);
        changed = true;
      }

      // Animate scale
      if (Math.abs(instance.currentScale - instance.targetScale) > 0.001) {
        instance.currentScale = THREE.MathUtils.lerp(
          instance.currentScale,
          instance.targetScale,
          deltaTime * this.scaleSpeed
        );
        changed = true;

        // Check if deletion animation is complete
        if (instance.isDeleting && instance.currentScale < 0.01) {
          toDelete.push(uid);
        }
      }

      // Handle new pod animation
      if (instance.isNew) {
        instance.animationProgress += deltaTime * 2;
        if (instance.animationProgress >= 1) {
          instance.isNew = false;
          instance.animationProgress = 0;
        }
        changed = true;
      }

      if (changed) {
        needsUpdate = true;
      }
    });

    // Remove deleted pods
    toDelete.forEach(uid => {
      const instance = this.podInstances.get(uid);
      if (instance) {
        const statusGroup = this.statusGroups.get(instance.pod.status);
        if (statusGroup) {
          statusGroup.delete(uid);
        }
        this.podInstances.delete(uid);
      }
    });

    if (needsUpdate || toDelete.length > 0) {
      this.updateInstanceMatrices();
    }
  }

  public getRaycasterIntersections(raycaster: THREE.Raycaster): Pod | null {
    let closestPod: Pod | null = null;
    let closestDistance = Infinity;

    this.instancedMeshes.forEach((mesh, status) => {
      const intersects = raycaster.intersectObject(mesh);
      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;
        if (instanceId !== undefined) {
          // Find pod by status and instance index
          let currentIndex = 0;
          for (const [, instance] of this.podInstances.entries()) {
            if (instance.pod.status === status) {
              if (currentIndex === instanceId) {
                if (intersects[0].distance < closestDistance) {
                  closestDistance = intersects[0].distance;
                  closestPod = instance.pod;
                }
                break;
              }
              currentIndex++;
            }
          }
        }
      }
    });

    return closestPod;
  }

  public getPodCount(): number {
    return this.podInstances.size;
  }

  public getStats(): { instances: number; meshes: number; drawCalls: number } {
    let drawCalls = 0;
    this.instancedMeshes.forEach(mesh => {
      if (mesh.count > 0) drawCalls++;
    });

    return {
      instances: this.podInstances.size,
      meshes: this.instancedMeshes.size,
      drawCalls
    };
  }

  public dispose(): void {
    this.instancedMeshes.forEach(mesh => {
      this.parent.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose();
      }
    });

    this.instancedMeshes.clear();
    this.podInstances.clear();
    this.statusGroups.clear();
  }
}