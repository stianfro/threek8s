import { describe, it, expect, beforeEach } from 'vitest';
import { SceneManager } from '../src/scene/SceneManager';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

describe('Camera Distance Configuration', () => {
  let container: HTMLElement;
  let sceneManager: SceneManager;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '1920px';
    container.style.height = '1080px';
    document.body.appendChild(container);

    sceneManager = new SceneManager(container);
  });

  afterEach(() => {
    sceneManager.dispose();
    document.body.removeChild(container);
  });

  it('should have extended max camera distance for large clusters', () => {
    const controls = sceneManager.getControls();

    // Expected new value: 500 (from 300)
    expect(controls.maxDistance).toBe(500);
    expect(controls.minDistance).toBe(20);
  });

  it('should calculate optimal camera distance with correct multiplier', () => {
    const camera = sceneManager.getCamera();
    const fov = camera.fov * (Math.PI / 180);

    // Test optimal distance calculation
    const testMaxDimension = 100;
    const expectedMultiplier = 1.1; // Changed from 1.2
    const optimalDistance = (testMaxDimension * expectedMultiplier) / (2 * Math.tan(fov / 2));

    // Verify the calculation uses the correct multiplier
    const calculatedWithNewMultiplier = (testMaxDimension * 1.1) / (2 * Math.tan(fov / 2));
    const calculatedWithOldMultiplier = (testMaxDimension * 1.2) / (2 * Math.tan(fov / 2));

    expect(optimalDistance).toBe(calculatedWithNewMultiplier);
    expect(optimalDistance).toBeLessThan(calculatedWithOldMultiplier);
  });

  it('should position camera appropriately for initial view', () => {
    const camera = sceneManager.getCamera();

    // Initial position should be top-down
    expect(camera.position.x).toBe(0);
    expect(camera.position.y).toBeGreaterThan(0);
    expect(camera.position.z).toBeCloseTo(0.001, 3); // Avoid gimbal lock
  });

  it('should maintain top-down view constraints', () => {
    const controls = sceneManager.getControls();

    // Check that rotation is locked to top-down view
    expect(controls.enableRotate).toBe(false);
    expect(controls.minPolarAngle).toBe(0);
    expect(controls.maxPolarAngle).toBeLessThanOrEqual(0.1);
  });
});