import { describe, it, expect, beforeEach } from 'vitest';
import { VisualizationManager } from '../src/visualization/VisualizationManager';
import { SceneManager } from '../src/scene/SceneManager';
import * as THREE from 'three';

describe('Viewport Fill Ratio', () => {
  let container: HTMLElement;
  let sceneManager: SceneManager;
  let visualizationManager: VisualizationManager;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    document.body.appendChild(container);

    sceneManager = new SceneManager(container);
    visualizationManager = new VisualizationManager(sceneManager);
  });

  afterEach(() => {
    visualizationManager.dispose();
    sceneManager.dispose();
    document.body.removeChild(container);
  });

  it('should fill 80-90% of viewport with nodes on initial load', () => {
    // Test with 10 nodes
    const mockNodes = Array.from({ length: 10 }, (_, i) => ({
      uid: `node-${i}`,
      name: `node-${i}`,
      status: 'Ready',
      role: 'worker',
      kubeletVersion: 'v1.25.0',
      capacity: { cpu: '4', memory: '8Gi' },
      allocatable: { cpu: '3.5', memory: '7Gi' },
      conditions: [],
      addresses: [],
      labels: {},
      annotations: {}
    }));

    visualizationManager.updateState({ nodes: mockNodes, pods: [] });

    // Calculate bounding box of all nodes
    const nodeGroup = sceneManager.getScene().getObjectByName('nodes');
    const box = new THREE.Box3().setFromObject(nodeGroup);
    const size = box.getSize(new THREE.Vector3());

    // Calculate visible area
    const camera = sceneManager.getCamera();
    const distance = camera.position.y;
    const vFov = (camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * distance;
    const visibleWidth = visibleHeight * camera.aspect;

    // Calculate fill ratio
    const fillRatioWidth = size.x / visibleWidth;
    const fillRatioHeight = size.z / visibleHeight;
    const fillRatio = Math.max(fillRatioWidth, fillRatioHeight);

    // Expect nodes to fill 80-90% of viewport
    expect(fillRatio).toBeGreaterThanOrEqual(0.8);
    expect(fillRatio).toBeLessThanOrEqual(0.9);
  });

  it('should adjust camera distance based on cluster size', () => {
    // Test with different cluster sizes
    const clusterSizes = [1, 5, 10, 25, 50, 100];

    clusterSizes.forEach(size => {
      const mockNodes = Array.from({ length: size }, (_, i) => ({
        uid: `node-${i}`,
        name: `node-${i}`,
        status: 'Ready',
        role: 'worker',
        kubeletVersion: 'v1.25.0',
        capacity: { cpu: '4', memory: '8Gi' },
        allocatable: { cpu: '3.5', memory: '7Gi' },
        conditions: [],
        addresses: [],
        labels: {},
        annotations: {}
      }));

      visualizationManager.updateState({ nodes: mockNodes, pods: [] });

      const camera = sceneManager.getCamera();
      const expectedMinHeight = size <= 10 ? 50 : size <= 50 ? 80 : 100;
      const expectedMaxHeight = size <= 10 ? 150 : size <= 50 ? 300 : 500;

      expect(camera.position.y).toBeGreaterThanOrEqual(expectedMinHeight);
      expect(camera.position.y).toBeLessThanOrEqual(expectedMaxHeight);
    });
  });
});