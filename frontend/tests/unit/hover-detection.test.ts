import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';

// Mock the hover detection service that we'll create
class MockHoverDetectionService {
  private raycaster: THREE.Raycaster;
  private hoverableObjects: Map<THREE.Object3D, { type: string; metadata: any }>;

  constructor() {
    this.raycaster = new THREE.Raycaster();
    this.hoverableObjects = new Map();
  }

  detectHover(mousePosition: THREE.Vector2, camera: THREE.Camera) {
    this.raycaster.setFromCamera(mousePosition, camera);
    const objects = Array.from(this.hoverableObjects.keys());
    const intersections = this.raycaster.intersectObjects(objects, true);

    if (intersections.length === 0) {
      return {
        isHovering: false,
        target: null,
        targetType: null,
        intersections: [],
        distance: Infinity
      };
    }

    // Apply priority: pods before nodes, closer before farther
    const sortedIntersections = this.prioritizeIntersections(intersections);
    const first = sortedIntersections[0];
    const target = this.findHoverableParent(first.object);
    const data = target ? this.hoverableObjects.get(target) : null;

    return {
      isHovering: true,
      target,
      targetType: data?.type || null,
      intersections: sortedIntersections,
      instanceId: first.instanceId,
      metadata: data?.metadata,
      distance: first.distance
    };
  }

  private prioritizeIntersections(intersections: THREE.Intersection[]) {
    return intersections.sort((a, b) => {
      const aParent = this.findHoverableParent(a.object);
      const bParent = this.findHoverableParent(b.object);
      const aData = aParent ? this.hoverableObjects.get(aParent) : null;
      const bData = bParent ? this.hoverableObjects.get(bParent) : null;

      // Pods have priority over nodes
      if (aData?.type === 'pod' && bData?.type === 'node') return -1;
      if (aData?.type === 'node' && bData?.type === 'pod') return 1;

      // Closer objects have priority
      return a.distance - b.distance;
    });
  }

  private findHoverableParent(object: THREE.Object3D): THREE.Object3D | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (this.hoverableObjects.has(current)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  registerHoverable(object: THREE.Object3D, type: string, metadata: any) {
    this.hoverableObjects.set(object, { type, metadata });
  }

  unregisterHoverable(object: THREE.Object3D) {
    this.hoverableObjects.delete(object);
  }
}

describe('Hover Detection', () => {
  let service: MockHoverDetectionService;
  let camera: THREE.PerspectiveCamera;
  let scene: THREE.Scene;

  beforeEach(() => {
    service = new MockHoverDetectionService();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 0, 10);
    scene = new THREE.Scene();
  });

  describe('Raycaster Initialization', () => {
    it('should create a raycaster instance', () => {
      expect(service['raycaster']).toBeDefined();
      expect(service['raycaster']).toBeInstanceOf(THREE.Raycaster);
    });

    it('should initialize empty hoverable objects map', () => {
      expect(service['hoverableObjects'].size).toBe(0);
    });
  });

  describe('Mouse Coordinate Conversion', () => {
    it('should convert screen coordinates to normalized device coordinates', () => {
      const mouse = new THREE.Vector2(0.5, -0.5); // NDC coordinates
      const result = service.detectHover(mouse, camera);
      expect(result).toBeDefined();
    });

    it('should handle edge coordinates correctly', () => {
      const corners = [
        new THREE.Vector2(-1, -1), // Bottom left
        new THREE.Vector2(1, -1),  // Bottom right
        new THREE.Vector2(-1, 1),  // Top left
        new THREE.Vector2(1, 1)    // Top right
      ];

      corners.forEach(corner => {
        const result = service.detectHover(corner, camera);
        expect(result.isHovering).toBe(false); // No objects to hit
      });
    });
  });

  describe('Pod Intersection Detection', () => {
    it('should detect hover on pod mesh', () => {
      const pod = new THREE.Mesh(
        new THREE.SphereGeometry(1),
        new THREE.MeshBasicMaterial()
      );
      pod.position.set(0, 0, 0);
      scene.add(pod);
      service.registerHoverable(pod, 'pod', { name: 'test-pod' });

      const mouse = new THREE.Vector2(0, 0);
      const result = service.detectHover(mouse, camera);

      expect(result.isHovering).toBe(true);
      expect(result.targetType).toBe('pod');
      expect(result.metadata.name).toBe('test-pod');
    });

    it('should not detect hover when missing pod', () => {
      const pod = new THREE.Mesh(
        new THREE.SphereGeometry(1),
        new THREE.MeshBasicMaterial()
      );
      pod.position.set(100, 0, 0); // Far off screen
      scene.add(pod);
      service.registerHoverable(pod, 'pod', { name: 'test-pod' });

      const mouse = new THREE.Vector2(0, 0);
      const result = service.detectHover(mouse, camera);

      expect(result.isHovering).toBe(false);
    });
  });

  describe('Node Intersection Detection', () => {
    it('should detect hover on node mesh', () => {
      const node = new THREE.Mesh(
        new THREE.BoxGeometry(5, 5, 5),
        new THREE.MeshBasicMaterial()
      );
      node.position.set(0, 0, 0);
      scene.add(node);
      service.registerHoverable(node, 'node', { name: 'test-node' });

      const mouse = new THREE.Vector2(0, 0);
      const result = service.detectHover(mouse, camera);

      expect(result.isHovering).toBe(true);
      expect(result.targetType).toBe('node');
      expect(result.metadata.name).toBe('test-node');
    });
  });

  describe('Hover Priority (Pods over Nodes)', () => {
    it('should prioritize pod over node when overlapping', () => {
      // Create a node
      const node = new THREE.Mesh(
        new THREE.BoxGeometry(5, 5, 5),
        new THREE.MeshBasicMaterial()
      );
      node.position.set(0, 0, 0);
      scene.add(node);
      service.registerHoverable(node, 'node', { name: 'test-node' });

      // Create a pod inside the node
      const pod = new THREE.Mesh(
        new THREE.SphereGeometry(1),
        new THREE.MeshBasicMaterial()
      );
      pod.position.set(0, 0, 2); // Slightly in front
      scene.add(pod);
      service.registerHoverable(pod, 'pod', { name: 'test-pod' });

      const mouse = new THREE.Vector2(0, 0);
      const result = service.detectHover(mouse, camera);

      expect(result.isHovering).toBe(true);
      expect(result.targetType).toBe('pod'); // Pod should have priority
      expect(result.metadata.name).toBe('test-pod');
    });

    it('should prioritize closer object when same type', () => {
      const pod1 = new THREE.Mesh(
        new THREE.SphereGeometry(1),
        new THREE.MeshBasicMaterial()
      );
      pod1.position.set(0, 0, 0);
      scene.add(pod1);
      service.registerHoverable(pod1, 'pod', { name: 'far-pod' });

      const pod2 = new THREE.Mesh(
        new THREE.SphereGeometry(1),
        new THREE.MeshBasicMaterial()
      );
      pod2.position.set(0, 0, 2); // Closer to camera
      scene.add(pod2);
      service.registerHoverable(pod2, 'pod', { name: 'near-pod' });

      const mouse = new THREE.Vector2(0, 0);
      const result = service.detectHover(mouse, camera);

      expect(result.isHovering).toBe(true);
      expect(result.metadata.name).toBe('near-pod');
    });
  });

  describe('Instance Detection', () => {
    it('should handle instanced mesh intersections', () => {
      const geometry = new THREE.SphereGeometry(1);
      const material = new THREE.MeshBasicMaterial();
      const instancedMesh = new THREE.InstancedMesh(geometry, material, 10);

      // Set instance matrices
      const matrix = new THREE.Matrix4();
      for (let i = 0; i < 10; i++) {
        matrix.setPosition(i * 2 - 9, 0, 0);
        instancedMesh.setMatrixAt(i, matrix);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;

      scene.add(instancedMesh);
      service.registerHoverable(instancedMesh, 'pod-instance', { type: 'instanced' });

      // Test hovering over first instance
      const mouse = new THREE.Vector2(-0.9, 0);
      const result = service.detectHover(mouse, camera);

      expect(result.isHovering).toBe(true);
      expect(result.targetType).toBe('pod-instance');
      expect(result.instanceId).toBeDefined();
    });
  });

  describe('Registration and Cleanup', () => {
    it('should register hoverable objects', () => {
      const obj = new THREE.Object3D();
      service.registerHoverable(obj, 'test', { data: 'value' });

      expect(service['hoverableObjects'].has(obj)).toBe(true);
      expect(service['hoverableObjects'].get(obj)?.type).toBe('test');
    });

    it('should unregister hoverable objects', () => {
      const obj = new THREE.Object3D();
      service.registerHoverable(obj, 'test', {});
      service.unregisterHoverable(obj);

      expect(service['hoverableObjects'].has(obj)).toBe(false);
    });
  });
});