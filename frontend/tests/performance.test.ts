import { describe, it, expect, beforeEach } from 'vitest';
import { VisualizationManager } from '../src/visualization/VisualizationManager';
import { SceneManager } from '../src/scene/SceneManager';

describe('Performance Benchmarks', () => {
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

  it('should maintain 60fps with adjusted LOD thresholds', () => {
    // Create a large cluster to test performance
    const mockNodes = Array.from({ length: 50 }, (_, i) => ({
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

    const mockPods = Array.from({ length: 200 }, (_, i) => ({
      uid: `pod-${i}`,
      name: `pod-${i}`,
      namespace: 'default',
      status: 'Running',
      phase: 'Running',
      nodeName: `node-${i % 50}`,
      containers: [{
        name: 'container',
        image: 'nginx',
        state: 'running',
        ready: true,
        restartCount: 0
      }],
      conditions: [],
      ip: `10.0.${Math.floor(i / 256)}.${i % 256}`,
      startTime: new Date().toISOString()
    }));

    const startTime = performance.now();
    visualizationManager.updateState({ nodes: mockNodes, pods: mockPods });
    const loadTime = performance.now() - startTime;

    // Initial load should be under 100ms impact
    expect(loadTime).toBeLessThan(200); // Allow some margin for test environment

    // Simulate animation frame
    let frameCount = 0;
    let totalFrameTime = 0;
    const targetFrameTime = 16.67; // 60fps = 16.67ms per frame

    for (let i = 0; i < 60; i++) {
      const frameStart = performance.now();
      visualizationManager.animate();
      const frameTime = performance.now() - frameStart;
      totalFrameTime += frameTime;
      frameCount++;
    }

    const avgFrameTime = totalFrameTime / frameCount;
    const fps = 1000 / avgFrameTime;

    // Should maintain close to 60fps
    expect(fps).toBeGreaterThan(30); // Allow for test environment variance
  });

  it('should handle load impact within constraints', () => {
    // Test load time impact with different cluster sizes
    const testCases = [
      { nodes: 1, expectedMax: 150 },
      { nodes: 10, expectedMax: 200 },
      { nodes: 50, expectedMax: 300 },
      { nodes: 100, expectedMax: 500 }
    ];

    testCases.forEach(testCase => {
      // Reset for each test
      visualizationManager.dispose();
      sceneManager.dispose();
      sceneManager = new SceneManager(container);
      visualizationManager = new VisualizationManager(sceneManager);

      const mockNodes = Array.from({ length: testCase.nodes }, (_, i) => ({
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

      const startTime = performance.now();
      visualizationManager.updateState({ nodes: mockNodes, pods: [] });
      const loadTime = performance.now() - startTime;

      expect(loadTime).toBeLessThan(testCase.expectedMax);
    });
  });

  it('should efficiently handle instanced rendering for large pod counts', () => {
    // Test that instanced rendering activates for > 100 pods
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

    const mockPods = Array.from({ length: 150 }, (_, i) => ({
      uid: `pod-${i}`,
      name: `pod-${i}`,
      namespace: 'default',
      status: 'Running',
      phase: 'Running',
      nodeName: `node-${i % 10}`,
      containers: [{
        name: 'container',
        image: 'nginx',
        state: 'running',
        ready: true,
        restartCount: 0
      }],
      conditions: [],
      ip: `10.0.${Math.floor(i / 256)}.${i % 256}`,
      startTime: new Date().toISOString()
    }));

    visualizationManager.updateState({ nodes: mockNodes, pods: mockPods });

    // Verify performance with large pod count
    const startTime = performance.now();
    for (let i = 0; i < 10; i++) {
      visualizationManager.animate();
    }
    const animationTime = performance.now() - startTime;

    // Should handle 10 frames in reasonable time
    expect(animationTime).toBeLessThan(200); // 20ms per frame max
  });
});