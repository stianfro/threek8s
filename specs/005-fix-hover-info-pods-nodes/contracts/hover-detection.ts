/**
 * Contract for hover detection system
 * This defines the interfaces for Three.js raycasting and hover state management
 */

import type { Object3D, Vector2, Raycaster, Intersection } from 'three';

/**
 * Hover target types
 */
export type HoverTargetType = 'pod' | 'node' | null;

/**
 * Hover detection service interface
 */
export interface IHoverDetectionService {
  /**
   * Detect hoverable objects at mouse position
   * @param mousePosition Normalized mouse coordinates (-1 to 1)
   * @param camera Current camera for raycasting
   * @returns Hover detection result
   */
  detectHover(mousePosition: Vector2, camera: Camera): HoverDetectionResult;

  /**
   * Register an object as hoverable
   * @param object Three.js object to make hoverable
   * @param type Type of Kubernetes object
   * @param metadata Associated metadata for tooltips
   */
  registerHoverable(object: Object3D, type: HoverTargetType, metadata: any): void;

  /**
   * Unregister a hoverable object
   * @param object Three.js object to remove from hoverable list
   */
  unregisterHoverable(object: Object3D): void;

  /**
   * Update hover detection settings
   * @param config Partial configuration to apply
   */
  configure(config: Partial<HoverDetectionConfig>): void;
}

/**
 * Configuration for hover detection behavior
 */
export interface HoverDetectionConfig {
  /** Layers to include in raycasting (bitmask) */
  layers: number;
  /** Maximum distance for hover detection */
  maxDistance: number;
  /** Enable hover for nodes */
  enableNodeHover: boolean;
  /** Enable hover for pods */
  enablePodHover: boolean;
  /** Priority order for overlapping objects */
  priority: 'pods-first' | 'nodes-first' | 'closest-first';
}

/**
 * Result of hover detection
 */
export interface HoverDetectionResult {
  /** Whether any object is being hovered */
  isHovering: boolean;
  /** Primary hover target */
  target: Object3D | null;
  /** Type of hovered object */
  targetType: HoverTargetType;
  /** All intersections found */
  intersections: Intersection[];
  /** Instance ID for instanced meshes */
  instanceId?: number;
  /** Associated metadata */
  metadata?: any;
  /** Distance to target */
  distance: number;
}

/**
 * Raycaster wrapper for hover detection
 */
export interface IRaycasterService {
  /** Get or create raycaster instance */
  getRaycaster(): Raycaster;

  /** Update raycaster with mouse position and camera */
  updateRaycaster(mousePosition: Vector2, camera: Camera): void;

  /** Perform intersection test */
  intersectObjects(objects: Object3D[], recursive?: boolean): Intersection[];

  /** Perform intersection test for instanced mesh */
  intersectInstances(instancedMesh: InstancedMesh): InstanceIntersection[];
}

/**
 * Instance intersection result
 */
export interface InstanceIntersection extends Intersection {
  /** ID of the specific instance hit */
  instanceId: number;
}

/**
 * Priority resolver for multiple hover candidates
 */
export interface IHoverPriorityResolver {
  /**
   * Resolve primary hover target from candidates
   * @param candidates All intersected objects
   * @param config Current hover configuration
   * @returns Primary hover target or null
   */
  resolvePriority(
    candidates: HoverDetectionResult[],
    config: HoverDetectionConfig
  ): HoverDetectionResult | null;
}