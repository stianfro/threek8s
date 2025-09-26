/**
 * Contract for tooltip display system
 * This defines interfaces for showing Kubernetes object information in tooltips
 */

/**
 * Base tooltip data interface
 */
export interface TooltipData {
  /** Type of object being displayed */
  type: 'pod' | 'node';
  /** Primary display name */
  title: string;
  /** Additional fields to display */
  fields: TooltipField[];
  /** Timestamp for last update */
  lastUpdated?: Date;
}

/**
 * Individual tooltip field
 */
export interface TooltipField {
  /** Field label */
  label: string;
  /** Field value */
  value: string | number;
  /** Optional icon/emoji */
  icon?: string;
  /** Field importance for layout */
  priority?: 'high' | 'normal' | 'low';
  /** Special formatting */
  format?: 'status' | 'resource' | 'time' | 'number';
}

/**
 * Pod-specific tooltip data
 */
export interface PodTooltipData extends TooltipData {
  type: 'pod';
  name: string;
  namespace: string;
  status: string;
  statusColor?: string;
  containerCount: number;
  ready: string;
  restarts: number;
  nodeName: string;
  age: string;
  createdAt: Date;
}

/**
 * Node-specific tooltip data
 */
export interface NodeTooltipData extends TooltipData {
  type: 'node';
  name: string;
  status: string;
  statusColor?: string;
  capacity: {
    cpu: string;
    memory: string;
  };
  allocatable: {
    cpu: string;
    memory: string;
  };
  usage?: {
    cpu: string;
    memory: string;
  };
  podCount: number;
  maxPods: number;
  os: string;
  kernelVersion: string;
  kubeletVersion: string;
  containerRuntime: string;
  age: string;
}

/**
 * Tooltip display service interface
 */
export interface ITooltipService {
  /**
   * Show tooltip with data at position
   * @param data Tooltip content to display
   * @param position Screen coordinates for tooltip
   * @param config Optional display configuration
   */
  show(
    data: TooltipData,
    position: TooltipPosition,
    config?: Partial<TooltipDisplayConfig>
  ): void;

  /**
   * Hide the current tooltip
   * @param immediate Skip fade animation
   */
  hide(immediate?: boolean): void;

  /**
   * Update tooltip position
   * @param position New screen coordinates
   */
  updatePosition(position: TooltipPosition): void;

  /**
   * Update tooltip content
   * @param data New tooltip data
   */
  updateContent(data: TooltipData): void;

  /**
   * Check if tooltip is currently visible
   */
  isVisible(): boolean;

  /**
   * Configure tooltip behavior
   * @param config Partial configuration to apply
   */
  configure(config: Partial<TooltipDisplayConfig>): void;
}

/**
 * Tooltip position on screen
 */
export interface TooltipPosition {
  /** X coordinate in pixels */
  x: number;
  /** Y coordinate in pixels */
  y: number;
  /** Optional anchor point */
  anchor?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * Tooltip display configuration
 */
export interface TooltipDisplayConfig {
  /** Delay before showing tooltip (ms) */
  showDelay: number;
  /** Delay before hiding tooltip (ms) */
  hideDelay: number;
  /** Fade in animation duration (ms) */
  fadeInDuration: number;
  /** Fade out animation duration (ms) */
  fadeOutDuration: number;
  /** Offset from cursor position */
  offset: { x: number; y: number };
  /** Maximum tooltip width */
  maxWidth: number;
  /** Follow cursor movement */
  followCursor: boolean;
  /** Keep within viewport bounds */
  constrainToViewport: boolean;
  /** Z-index for tooltip */
  zIndex: number;
}

/**
 * Tooltip data provider interface
 */
export interface ITooltipDataProvider {
  /**
   * Get tooltip data for a pod
   * @param podId Unique identifier for the pod
   * @returns Pod tooltip data or null if not found
   */
  getPodTooltipData(podId: string): PodTooltipData | null;

  /**
   * Get tooltip data for a node
   * @param nodeName Name of the node
   * @returns Node tooltip data or null if not found
   */
  getNodeTooltipData(nodeName: string): NodeTooltipData | null;

  /**
   * Format timestamp as relative time
   * @param timestamp Date to format
   * @returns Human-readable relative time
   */
  formatAge(timestamp: Date): string;

  /**
   * Format Kubernetes resource quantity
   * @param quantity Resource quantity string
   * @returns Human-readable format
   */
  formatResource(quantity: string): string;
}

/**
 * Tooltip renderer interface for DOM manipulation
 */
export interface ITooltipRenderer {
  /**
   * Render tooltip HTML
   * @param data Tooltip data to render
   * @returns HTML string or DOM element
   */
  render(data: TooltipData): HTMLElement | string;

  /**
   * Apply position to tooltip element
   * @param element Tooltip DOM element
   * @param position Screen position
   * @param config Display configuration
   */
  position(
    element: HTMLElement,
    position: TooltipPosition,
    config: TooltipDisplayConfig
  ): void;

  /**
   * Apply visibility animation
   * @param element Tooltip DOM element
   * @param visible Show or hide
   * @param duration Animation duration
   */
  animate(
    element: HTMLElement,
    visible: boolean,
    duration: number
  ): Promise<void>;
}