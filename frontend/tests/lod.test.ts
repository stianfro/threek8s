import { describe, it, expect, beforeEach } from 'vitest';
import { LODManager, DetailLevel } from '../src/visualization/LODManager';
import * as THREE from 'three';

describe('LOD Threshold Configuration', () => {
  let camera: THREE.PerspectiveCamera;
  let lodManager: LODManager;

  beforeEach(() => {
    camera = new THREE.PerspectiveCamera(60, 16/9, 0.1, 1000);
    lodManager = new LODManager(camera);
  });

  it('should have extended LOD thresholds for better pod visibility', () => {
    // Test that pods are visible at greater distances
    // Expected new thresholds: high=250, medium=450, low=750

    // Test at 200 units (should be HIGH with new thresholds)
    camera.position.set(0, 200, 0);
    const levelAt200 = lodManager.updateLOD(new THREE.Vector3(0, 0, 0));
    expect(levelAt200).toBe(DetailLevel.HIGH);
    expect(lodManager.shouldRenderPods()).toBe(true);
    expect(lodManager.shouldAnimatePods()).toBe(true);

    // Test at 350 units (should be MEDIUM with new thresholds)
    camera.position.set(0, 350, 0);
    const levelAt350 = lodManager.updateLOD(new THREE.Vector3(0, 0, 0));
    expect(levelAt350).toBe(DetailLevel.MEDIUM);
    expect(lodManager.shouldRenderPods()).toBe(true);
    expect(lodManager.shouldAnimatePods()).toBe(false);

    // Test at 600 units (should be LOW with new thresholds)
    camera.position.set(0, 600, 0);
    const levelAt600 = lodManager.updateLOD(new THREE.Vector3(0, 0, 0));
    expect(levelAt600).toBe(DetailLevel.LOW);
    expect(lodManager.shouldRenderPods()).toBe(false);

    // Test at 800 units (should be MINIMAL)
    camera.position.set(0, 800, 0);
    const levelAt800 = lodManager.updateLOD(new THREE.Vector3(0, 0, 0));
    expect(levelAt800).toBe(DetailLevel.MINIMAL);
    expect(lodManager.shouldRenderPods()).toBe(false);
  });

  it('should maintain smooth transitions between LOD levels', () => {
    // Test transition points
    const transitionPoints = [249, 250, 251, 449, 450, 451, 749, 750, 751];
    const expectedLevels = [
      DetailLevel.HIGH, DetailLevel.MEDIUM, DetailLevel.MEDIUM,
      DetailLevel.MEDIUM, DetailLevel.LOW, DetailLevel.LOW,
      DetailLevel.LOW, DetailLevel.MINIMAL, DetailLevel.MINIMAL
    ];

    transitionPoints.forEach((distance, index) => {
      camera.position.set(0, distance, 0);
      const level = lodManager.updateLOD(new THREE.Vector3(0, 0, 0));
      expect(level).toBe(expectedLevels[index]);
    });
  });

  it('should have appropriate opacity values for each LOD level', () => {
    // Test opacity values remain functional
    expect(lodManager.getPodOpacity()).toBeGreaterThan(0);
    expect(lodManager.getPodOpacity()).toBeLessThanOrEqual(1);

    expect(lodManager.getNodeOpacity()).toBeGreaterThan(0);
    expect(lodManager.getNodeOpacity()).toBeLessThanOrEqual(1);
  });
});