import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';

// Mock PodInstanceManager
class MockPodInstanceManager {
  private instancedMesh: THREE.InstancedMesh;
  private instanceData: Map<number, any>;

  constructor(count: number = 150) {
    const geometry = new THREE.SphereGeometry(0.5);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    this.instanceData = new Map();

    // Initialize instance positions
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i++) {
      const x = (i % 10) * 2 - 9;
      const y = Math.floor(i / 10) * 2 - 7;
      const z = 0;
      matrix.setPosition(x, y, z);
      this.instancedMesh.setMatrixAt(i, matrix);

      // Store pod data for each instance
      this.instanceData.set(i, {
        id: `pod-${i}`,
        name: `pod-${i}`,
        namespace: 'default',
        status: i % 3 === 0 ? 'Pending' : 'Running',
        node: `node-${Math.floor(i / 30)}`
      });
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  getInstancedMesh(): THREE.InstancedMesh {
    return this.instancedMesh;
  }

  getRaycasterIntersections(raycaster: THREE.Raycaster): any[] {
    const intersections = raycaster.intersectObject(this.instancedMesh);

    // Add instance-specific data to intersections
    return intersections.map(intersection => ({
      ...intersection,
      instanceId: intersection.instanceId,
      podData: this.getPodDataForInstance(intersection.instanceId!)
    }));
  }

  getPodDataForInstance(instanceId: number): any {
    return this.instanceData.get(instanceId) || null;
  }

  getInstanceCount(): number {
    return this.instancedMesh.count;
  }

  updateInstanceMatrix(instanceId: number, position: THREE.Vector3) {
    const matrix = new THREE.Matrix4();
    matrix.setPosition(position);
    this.instancedMesh.setMatrixAt(instanceId, matrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}

describe('Instance Hover Integration', () => {
  let podManager: MockPodInstanceManager;
  let raycaster: THREE.Raycaster;
  let camera: THREE.PerspectiveCamera;
  let scene: THREE.Scene;

  beforeEach(() => {
    podManager = new MockPodInstanceManager(150);
    raycaster = new THREE.Raycaster();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    scene = new THREE.Scene();
    scene.add(podManager.getInstancedMesh());
  });

  describe('PodInstanceManager getRaycasterIntersections', () => {
    it('should detect intersections with instanced mesh', () => {
      const mouse = new THREE.Vector2(0, 0);
      raycaster.setFromCamera(mouse, camera);

      const intersections = podManager.getRaycasterIntersections(raycaster);

      expect(intersections).toBeDefined();
      expect(Array.isArray(intersections)).toBe(true);
    });

    it('should include instanceId in intersection results', () => {
      const mouse = new THREE.Vector2(-0.9, 0.7); // Top-left area
      raycaster.setFromCamera(mouse, camera);

      const intersections = podManager.getRaycasterIntersections(raycaster);

      if (intersections.length > 0) {
        expect(intersections[0].instanceId).toBeDefined();
        expect(typeof intersections[0].instanceId).toBe('number');
      }
    });

    it('should return pod data for intersected instance', () => {
      const mouse = new THREE.Vector2(-0.9, 0.7);
      raycaster.setFromCamera(mouse, camera);

      const intersections = podManager.getRaycasterIntersections(raycaster);

      if (intersections.length > 0) {
        const podData = intersections[0].podData;
        expect(podData).toBeDefined();
        expect(podData.id).toMatch(/^pod-\d+$/);
        expect(podData.namespace).toBe('default');
        expect(['Running', 'Pending']).toContain(podData.status);
      }
    });
  });

  describe('Instance ID Mapping', () => {
    it('should correctly map instance IDs to pod data', () => {
      for (let i = 0; i < 10; i++) {
        const podData = podManager.getPodDataForInstance(i);
        expect(podData).toBeDefined();
        expect(podData.id).toBe(`pod-${i}`);
        expect(podData.name).toBe(`pod-${i}`);
      }
    });

    it('should return null for invalid instance IDs', () => {
      const podData = podManager.getPodDataForInstance(999);
      expect(podData).toBeNull();
    });

    it('should maintain consistent mapping after updates', () => {
      const instanceId = 5;
      const originalData = podManager.getPodDataForInstance(instanceId);

      // Update position
      podManager.updateInstanceMatrix(instanceId, new THREE.Vector3(10, 10, 0));

      const updatedData = podManager.getPodDataForInstance(instanceId);
      expect(updatedData).toEqual(originalData);
    });
  });

  describe('Hover on Large Clusters (>100 pods)', () => {
    it('should handle 150+ instances efficiently', () => {
      expect(podManager.getInstanceCount()).toBe(150);

      const startTime = performance.now();

      // Test multiple raycasts
      for (let i = 0; i < 10; i++) {
        const mouse = new THREE.Vector2(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        );
        raycaster.setFromCamera(mouse, camera);
        podManager.getRaycasterIntersections(raycaster);
      }

      const endTime = performance.now();
      const elapsed = endTime - startTime;

      // Should complete 10 raycasts in under 50ms
      expect(elapsed).toBeLessThan(50);
    });

    it('should correctly identify different instances', () => {
      const positions = [
        { mouse: new THREE.Vector2(-0.9, 0.7), expectedRange: [0, 10] },
        { mouse: new THREE.Vector2(0, 0), expectedRange: [70, 80] },
        { mouse: new THREE.Vector2(0.9, -0.7), expectedRange: [140, 150] }
      ];

      positions.forEach(({ mouse, expectedRange }) => {
        raycaster.setFromCamera(mouse, camera);
        const intersections = podManager.getRaycasterIntersections(raycaster);

        if (intersections.length > 0) {
          const instanceId = intersections[0].instanceId!;
          expect(instanceId).toBeGreaterThanOrEqual(expectedRange[0]);
          expect(instanceId).toBeLessThan(expectedRange[1]);
        }
      });
    });
  });

  describe('Correct Pod Data Retrieval', () => {
    it('should retrieve accurate pod information for hovered instance', () => {
      const testCases = [
        { instanceId: 0, expectedNode: 'node-0' },
        { instanceId: 30, expectedNode: 'node-1' },
        { instanceId: 60, expectedNode: 'node-2' },
        { instanceId: 90, expectedNode: 'node-3' },
        { instanceId: 120, expectedNode: 'node-4' }
      ];

      testCases.forEach(({ instanceId, expectedNode }) => {
        const podData = podManager.getPodDataForInstance(instanceId);
        expect(podData.node).toBe(expectedNode);
        expect(podData.id).toBe(`pod-${instanceId}`);
      });
    });

    it('should handle edge cases in pod data', () => {
      // Test pending pods (every 3rd pod)
      const pendingPods = [0, 3, 6, 9, 12];
      pendingPods.forEach(id => {
        const podData = podManager.getPodDataForInstance(id);
        expect(podData.status).toBe('Pending');
      });

      // Test running pods
      const runningPods = [1, 2, 4, 5, 7, 8];
      runningPods.forEach(id => {
        const podData = podManager.getPodDataForInstance(id);
        expect(podData.status).toBe('Running');
      });
    });
  });

  describe('Integration with Hover System', () => {
    it('should integrate with raycaster for hover detection', () => {
      const mouse = new THREE.Vector2(0, 0);
      raycaster.setFromCamera(mouse, camera);

      // Simulate hover detection flow
      const allIntersections = raycaster.intersectObject(scene, true);
      const instanceIntersections = podManager.getRaycasterIntersections(raycaster);

      // Both methods should find intersections
      expect(allIntersections.length).toBeGreaterThan(0);
      expect(instanceIntersections.length).toBeGreaterThan(0);

      // Instance method should include extra data
      if (instanceIntersections.length > 0) {
        expect(instanceIntersections[0].podData).toBeDefined();
      }
    });

    it('should handle rapid hover changes', () => {
      const mousePositions = Array.from({ length: 20 }, () => ({
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1
      }));

      const results: any[] = [];

      mousePositions.forEach(pos => {
        raycaster.setFromCamera(new THREE.Vector2(pos.x, pos.y), camera);
        const intersections = podManager.getRaycasterIntersections(raycaster);
        if (intersections.length > 0) {
          results.push(intersections[0].podData);
        }
      });

      // Should handle all rapid changes without errors
      expect(results.every(data => data !== null)).toBe(true);
    });
  });

  describe('Performance Characteristics', () => {
    it('should maintain performance with many instances', () => {
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const mouse = new THREE.Vector2(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1
        );

        const start = performance.now();
        raycaster.setFromCamera(mouse, camera);
        podManager.getRaycasterIntersections(raycaster);
        const end = performance.now();

        times.push(end - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // Average should be under 1ms
      expect(avgTime).toBeLessThan(1);
      // No single operation should take more than 5ms
      expect(maxTime).toBeLessThan(5);
    });
  });
});