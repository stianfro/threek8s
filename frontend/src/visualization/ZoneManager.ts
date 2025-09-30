import * as THREE from "three";
import type { KubernetesNode } from "../types/kubernetes";

export interface ZoneGroup {
  zoneName: string;
  nodes: KubernetesNode[];
  position: THREE.Vector3;
  size: { width: number; height: number };
  nodePositions: THREE.Vector3[];
  nodeScale: number;
}

export interface ZoneLayout {
  zones: ZoneGroup[];
  totalBounds: { width: number; height: number };
}

export interface ZoneInfo {
  name: string;
  nodeCount: number;
  readyNodes: number;
  totalCpu: string;
  totalMemory: string;
}

export class ZoneManager {
  private viewport: { width: number; height: number };

  constructor(viewport: { width: number; height: number }) {
    this.viewport = viewport;
  }

  public updateViewport(viewport: { width: number; height: number }): void {
    this.viewport = viewport;
  }

  /**
   * Groups nodes by zone and calculates complete layout
   */
  public calculateZoneLayout(nodes: KubernetesNode[]): ZoneLayout {
    // Group nodes by zone
    const zoneGroups = this.groupNodesByZone(nodes);

    // Calculate zone grid dimensions
    const zoneCount = zoneGroups.length;
    const { cols: zoneCols, rows: zoneRows } = this.calculateGridDimensions(
      zoneCount,
      this.viewport.width / this.viewport.height,
    );

    console.log("[ZoneManager] Zone grid layout:", {
      zoneCount,
      zoneCols,
      zoneRows,
      viewport: this.viewport,
    });

    // Calculate size allocation for each zone based on node count
    const zoneSizes = this.calculateZoneSizes(zoneGroups, zoneCols, zoneRows);
    const interZoneSpacing = 10; // Match spacing from calculateZoneSizes

    // Calculate positions and internal layouts for each zone
    const zones: ZoneGroup[] = [];
    let currentCol = 0;
    let rowHeight = 0;
    let xOffset = 0;
    let zOffset = 0;

    zoneGroups.forEach((group, index) => {
      const zoneSize = zoneSizes[index];
      if (!zoneSize) {
        console.error("Zone size not found for index", index);
        return;
      }

      const { nodePositions, nodeScale } = this.calculateNodeLayoutInZone(
        group.nodes,
        zoneSize.width,
        zoneSize.height,
      );

      // Calculate zone position in world space (position is at zone center)
      const zonePosition = new THREE.Vector3(
        xOffset + zoneSize.width / 2,
        0,
        zOffset + zoneSize.height / 2,
      );

      zones.push({
        zoneName: group.zoneName,
        nodes: group.nodes,
        position: zonePosition,
        size: zoneSize,
        nodePositions,
        nodeScale,
      });

      // Update grid position
      currentCol++;
      xOffset += zoneSize.width + interZoneSpacing; // Add spacing between zones
      rowHeight = Math.max(rowHeight, zoneSize.height);

      if (currentCol >= zoneCols) {
        currentCol = 0;
        xOffset = 0;
        zOffset += rowHeight + interZoneSpacing; // Add spacing between rows
        rowHeight = 0;
      }
    });

    // Center incomplete last row
    const zonesInLastRow = zoneCount % zoneCols;
    if (zonesInLastRow > 0 && zonesInLastRow < zoneCols) {
      // Calculate how much width the last row actually uses
      const lastRowStartIndex = zones.length - zonesInLastRow;
      let lastRowWidth = 0;

      for (let i = lastRowStartIndex; i < zones.length; i++) {
        const zone = zones[i];
        if (!zone) continue;
        lastRowWidth += zone.size.width;
        if (i < zones.length - 1) {
          lastRowWidth += interZoneSpacing;
        }
      }

      // Calculate centering offset for last row
      // Total grid width is based on zoneCols
      const fullRowWidth = zones
        .slice(0, Math.min(zoneCols, zones.length))
        .reduce((sum, z, i) => sum + z.size.width + (i < zoneCols - 1 ? interZoneSpacing : 0), 0);

      const rowCenterOffset = (fullRowWidth - lastRowWidth) / 2;

      // Apply offset to last row zones
      for (let i = lastRowStartIndex; i < zones.length; i++) {
        const zone = zones[i];
        if (!zone) continue;
        zone.position.x += rowCenterOffset;
      }
    }

    // Calculate total bounds
    const totalWidth = Math.max(...zones.map((z) => z.position.x + z.size.width / 2));
    const totalHeight = Math.max(...zones.map((z) => z.position.z + z.size.height / 2));

    // Center all zones around origin
    const centerOffsetX = totalWidth / 2;
    const centerOffsetZ = totalHeight / 2;

    zones.forEach((zone) => {
      zone.position.x -= centerOffsetX;
      zone.position.z -= centerOffsetZ;

      // Update node positions relative to zone center
      zone.nodePositions = zone.nodePositions.map(
        (pos) => new THREE.Vector3(zone.position.x + pos.x, pos.y, zone.position.z + pos.z),
      );
    });

    console.log("[ZoneManager] Layout complete:", {
      zoneCount: zones.length,
      totalBounds: { width: totalWidth, height: totalHeight },
      zones: zones.map((z) => ({
        name: z.zoneName,
        nodeCount: z.nodes.length,
        position: { x: z.position.x, z: z.position.z },
        size: z.size,
      })),
    });

    return {
      zones,
      totalBounds: { width: totalWidth, height: totalHeight },
    };
  }

  /**
   * Groups nodes by their zone label
   */
  private groupNodesByZone(
    nodes: KubernetesNode[],
  ): { zoneName: string; nodes: KubernetesNode[] }[] {
    const zoneMap = new Map<string, KubernetesNode[]>();

    nodes.forEach((node) => {
      const zoneName = node.zone || "N/A";
      const zoneNodes = zoneMap.get(zoneName) || [];
      zoneNodes.push(node);
      zoneMap.set(zoneName, zoneNodes);
    });

    // Convert to array and sort by zone name for consistent ordering
    return Array.from(zoneMap.entries())
      .map(([zoneName, nodes]) => ({ zoneName, nodes }))
      .sort((a, b) => {
        // Sort N/A last
        if (a.zoneName === "N/A") return 1;
        if (b.zoneName === "N/A") return -1;
        return a.zoneName.localeCompare(b.zoneName);
      });
  }

  /**
   * Calculates optimal grid dimensions for given item count and aspect ratio
   */
  private calculateGridDimensions(
    count: number,
    aspectRatio: number,
  ): { cols: number; rows: number } {
    let cols = Math.ceil(Math.sqrt(count * aspectRatio));
    let rows = Math.ceil(count / cols);

    // Ensure at least 2 columns for better layout when we have multiple zones
    if (cols < 2 && count > 1) cols = 2;

    return { cols, rows };
  }

  /**
   * Calculates the actual node size that will be used for a zone
   * This matches the exact logic in calculateNodeLayoutInZone
   */
  private calculateActualNodeSize(
    nodeCount: number,
    zoneWidth: number,
    zoneHeight: number,
  ): { nodeSize: number; spacingFactor: number } {
    const aspectRatio = zoneWidth / zoneHeight;
    const { cols, rows } = this.calculateGridDimensions(nodeCount, aspectRatio);

    // Get size constraints based on node count (matches calculateNodeLayoutInZone)
    let minNodeSize: number;
    let maxNodeSize: number;
    let spacingFactor: number;

    if (nodeCount <= 10) {
      minNodeSize = 15;
      maxNodeSize = 40;
      spacingFactor = 0.2;
    } else if (nodeCount <= 50) {
      minNodeSize = 8;
      maxNodeSize = 25;
      spacingFactor = 0.15;
    } else if (nodeCount <= 200) {
      minNodeSize = 4;
      maxNodeSize = 15;
      spacingFactor = 0.1;
    } else {
      minNodeSize = 2;
      maxNodeSize = 8;
      spacingFactor = 0.05;
    }

    // Calculate node size to fit in zone (matches calculateNodeLayoutInZone)
    const margin = 2;
    const availableWidth = (zoneWidth - 2 * margin) / (cols * (1 + spacingFactor));
    const availableHeight = (zoneHeight - 2 * margin) / (rows * (1 + spacingFactor));

    let nodeSize = Math.min(availableWidth, availableHeight);
    nodeSize = Math.max(minNodeSize, Math.min(maxNodeSize, nodeSize));

    return { nodeSize, spacingFactor };
  }

  /**
   * Calculates size for each zone based on actual space needed for nodes
   * Uses iterative approach to ensure zones are sized correctly
   */
  private calculateZoneSizes(
    zoneGroups: { zoneName: string; nodes: KubernetesNode[] }[],
    zoneCols: number,
    zoneRows: number,
  ): { width: number; height: number }[] {
    const interZoneSpacing = 10; // Spacing between zones
    const margin = 2; // Margin inside each zone
    const safetyMargin = 1.1; // 10% safety margin

    // Calculate available space
    const availableWidth = this.viewport.width - (zoneCols - 1) * interZoneSpacing;
    const availableHeight = this.viewport.height - (zoneRows - 1) * interZoneSpacing;

    // Initial size estimate per zone (assume equal distribution)
    const avgZoneWidth = availableWidth / zoneCols;
    const avgZoneHeight = availableHeight / zoneRows;
    const initialSize = Math.min(avgZoneWidth, avgZoneHeight);

    // Calculate required sizes using iterative refinement
    const zoneSizes = zoneGroups.map((group) => {
      const nodeCount = group.nodes.length;

      // Start with initial estimate
      let zoneSize = initialSize;

      // Refine size iteratively (up to 3 iterations should converge)
      for (let iteration = 0; iteration < 3; iteration++) {
        // Calculate what the actual node size would be for this zone size
        const { nodeSize, spacingFactor } = this.calculateActualNodeSize(
          nodeCount,
          zoneSize,
          zoneSize,
        );

        // Calculate grid dimensions
        const { cols, rows } = this.calculateGridDimensions(nodeCount, 1); // aspectRatio = 1 for square

        // Calculate actual space needed for this grid
        const spacing = nodeSize * (1 + spacingFactor);
        const gridWidth = cols * spacing - nodeSize * spacingFactor;
        const gridHeight = rows * spacing - nodeSize * spacingFactor;

        // Required zone size with margins
        const requiredWidth = gridWidth + 2 * margin;
        const requiredHeight = gridHeight + 2 * margin;
        const requiredSize = Math.max(requiredWidth, requiredHeight);

        // Apply safety margin
        zoneSize = requiredSize * safetyMargin;
      }

      return {
        width: zoneSize,
        height: zoneSize,
        nodeCount,
      };
    });

    // Check if zones fit in available space
    const maxZoneSize = Math.max(...zoneSizes.map((z) => z.width));
    const totalWidth = zoneCols * maxZoneSize + (zoneCols - 1) * interZoneSpacing;
    const totalHeight = zoneRows * maxZoneSize + (zoneRows - 1) * interZoneSpacing;

    // Scale down if needed to fit viewport
    let scale = 1.0;
    if (totalWidth > this.viewport.width || totalHeight > this.viewport.height) {
      const widthScale = this.viewport.width / totalWidth;
      const heightScale = this.viewport.height / totalHeight;
      scale = Math.min(widthScale, heightScale);
    }

    console.log("[ZoneManager] Zone sizing:", {
      zoneSizes,
      maxZoneSize,
      totalWidth,
      totalHeight,
      scale,
      viewport: this.viewport,
    });

    // Apply final scaling and return square zones
    return zoneSizes.map((size) => {
      const finalSize = size.width * scale;
      return {
        width: finalSize,
        height: finalSize,
      };
    });
  }

  /**
   * Calculates node positions within a single zone
   */
  private calculateNodeLayoutInZone(
    nodes: KubernetesNode[],
    zoneWidth: number,
    zoneHeight: number,
  ): { nodePositions: THREE.Vector3[]; nodeScale: number } {
    const nodeCount = nodes.length;
    const aspectRatio = zoneWidth / zoneHeight;

    // Calculate grid for nodes within zone
    const { cols, rows } = this.calculateGridDimensions(nodeCount, aspectRatio);

    // Base node size (matches NodeObject geometry)
    const baseNodeSize = 20;

    // Dynamic size constraints based on node count
    let minNodeSize: number;
    let maxNodeSize: number;
    let spacingFactor: number;

    if (nodeCount <= 10) {
      minNodeSize = 15;
      maxNodeSize = 40;
      spacingFactor = 0.2;
    } else if (nodeCount <= 50) {
      minNodeSize = 8;
      maxNodeSize = 25;
      spacingFactor = 0.15;
    } else if (nodeCount <= 200) {
      minNodeSize = 4;
      maxNodeSize = 15;
      spacingFactor = 0.1;
    } else {
      minNodeSize = 2;
      maxNodeSize = 8;
      spacingFactor = 0.05;
    }

    // Calculate node size to fit in zone
    const margin = 2; // Small margin inside zone
    const availableWidth = (zoneWidth - 2 * margin) / (cols * (1 + spacingFactor));
    const availableHeight = (zoneHeight - 2 * margin) / (rows * (1 + spacingFactor));

    let nodeSize = Math.min(availableWidth, availableHeight);
    nodeSize = Math.max(minNodeSize, Math.min(maxNodeSize, nodeSize));

    const spacing = nodeSize * (1 + spacingFactor);
    const scale = nodeSize / baseNodeSize;

    // Calculate positions (relative to zone center)
    const positions: THREE.Vector3[] = [];
    const gridWidth = cols * spacing - nodeSize * spacingFactor;
    const gridHeight = rows * spacing - nodeSize * spacingFactor;

    for (let i = 0; i < nodeCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const x = col * spacing - gridWidth / 2 + nodeSize / 2;
      const z = row * spacing - gridHeight / 2 + nodeSize / 2;
      const y = 0;

      positions.push(new THREE.Vector3(x, y, z));
    }

    return { nodePositions: positions, nodeScale: scale };
  }

  /**
   * Gets information about a zone for tooltips
   */
  public getZoneInfo(zoneName: string, nodes: KubernetesNode[]): ZoneInfo {
    const readyNodes = nodes.filter((n) => n.status === "Ready").length;

    // Calculate total resources
    const totalCpu = nodes.reduce((sum, node) => {
      const cpu = parseInt(node.capacity.cpu ?? "0") || 0;
      return sum + cpu;
    }, 0);

    const totalMemory = nodes.reduce((sum, node) => {
      const memStr = node.capacity.memory;
      const match = memStr.match(/(\d+)([A-Za-z]+)/);
      if (match && match[1] && match[2]) {
        const value = parseInt(match[1]);
        const unit = match[2];
        // Convert to Gi for display
        if (unit === "Ki") return sum + value / (1024 * 1024);
        if (unit === "Mi") return sum + value / 1024;
        if (unit === "Gi") return sum + value;
      }
      return sum;
    }, 0);

    return {
      name: zoneName,
      nodeCount: nodes.length,
      readyNodes,
      totalCpu: `${totalCpu} cores`,
      totalMemory: `${Math.round(totalMemory)} Gi`,
    };
  }

  /**
   * Finds which zone contains a given world position
   */
  public findZoneAtPosition(position: THREE.Vector3, layout: ZoneLayout): ZoneGroup | null {
    for (const zone of layout.zones) {
      const halfWidth = zone.size.width / 2;
      const halfHeight = zone.size.height / 2;

      const minX = zone.position.x - halfWidth;
      const maxX = zone.position.x + halfWidth;
      const minZ = zone.position.z - halfHeight;
      const maxZ = zone.position.z + halfHeight;

      if (position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ) {
        return zone;
      }
    }

    return null;
  }
}
