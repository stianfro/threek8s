import * as THREE from 'three';

export enum DetailLevel {
  HIGH = 'high',     // Close view - show everything
  MEDIUM = 'medium', // Medium distance - simplified pods
  LOW = 'low',       // Far view - aggregate representations
  MINIMAL = 'minimal' // Very far - just node indicators
}

export class LODManager {
  private camera: THREE.Camera;
  private currentLevel: DetailLevel = DetailLevel.HIGH;
  private lastCameraDistance: number = 0;

  // Distance thresholds for different detail levels
  private readonly thresholds = {
    high: 150,    // Closer than 150 units
    medium: 300,  // 150-300 units
    low: 500,     // 300-500 units
    minimal: Infinity // Beyond 500 units
  };

  constructor(camera: THREE.Camera) {
    this.camera = camera;
  }

  public updateLOD(targetPosition: THREE.Vector3 = new THREE.Vector3()): DetailLevel {
    const distance = this.camera.position.distanceTo(targetPosition);
    this.lastCameraDistance = distance;

    let newLevel: DetailLevel;
    if (distance < this.thresholds.high) {
      newLevel = DetailLevel.HIGH;
    } else if (distance < this.thresholds.medium) {
      newLevel = DetailLevel.MEDIUM;
    } else if (distance < this.thresholds.low) {
      newLevel = DetailLevel.LOW;
    } else {
      newLevel = DetailLevel.MINIMAL;
    }

    const changed = newLevel !== this.currentLevel;
    this.currentLevel = newLevel;

    if (changed) {
      console.log(`[LODManager] Detail level changed to: ${newLevel} at distance ${distance.toFixed(1)}`);
    }

    return this.currentLevel;
  }

  public getCurrentLevel(): DetailLevel {
    return this.currentLevel;
  }

  public getCameraDistance(): number {
    return this.lastCameraDistance;
  }

  public shouldRenderPods(): boolean {
    return this.currentLevel === DetailLevel.HIGH || this.currentLevel === DetailLevel.MEDIUM;
  }

  public shouldAnimatePods(): boolean {
    return this.currentLevel === DetailLevel.HIGH;
  }

  public shouldRenderNodeDetails(): boolean {
    return this.currentLevel !== DetailLevel.MINIMAL;
  }

  public getPodOpacity(): number {
    switch (this.currentLevel) {
      case DetailLevel.HIGH:
        return 0.95;
      case DetailLevel.MEDIUM:
        return 0.7;
      case DetailLevel.LOW:
        return 0.3;
      default:
        return 0;
    }
  }

  public getNodeOpacity(): number {
    switch (this.currentLevel) {
      case DetailLevel.HIGH:
      case DetailLevel.MEDIUM:
        return 0.3;
      case DetailLevel.LOW:
        return 0.5;
      case DetailLevel.MINIMAL:
        return 0.7;
    }
  }

  public getAnimationSpeedMultiplier(): number {
    switch (this.currentLevel) {
      case DetailLevel.HIGH:
        return 1.0;
      case DetailLevel.MEDIUM:
        return 0.5;
      case DetailLevel.LOW:
        return 0.1;
      default:
        return 0;
    }
  }
}