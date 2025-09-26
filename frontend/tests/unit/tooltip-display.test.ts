import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock tooltip service
class MockTooltipService {
  private element: HTMLElement | null = null;
  private visible: boolean = false;
  private config = {
    showDelay: 300,
    hideDelay: 0,
    fadeInDuration: 200,
    fadeOutDuration: 150,
    offset: { x: 10, y: 10 },
    maxWidth: 300,
    followCursor: true,
    constrainToViewport: true,
    zIndex: 9999
  };

  constructor() {
    this.createTooltipElement();
  }

  private createTooltipElement() {
    this.element = document.createElement('div');
    this.element.id = 'tooltip';
    this.element.className = 'tooltip';
    this.element.style.display = 'none';
    this.element.style.position = 'absolute';
    this.element.style.zIndex = String(this.config.zIndex);
    document.body.appendChild(this.element);
  }

  show(data: any, position: { x: number; y: number }, config?: any) {
    if (!this.element) return;

    const mergedConfig = { ...this.config, ...config };

    // Format content based on data type
    this.element.innerHTML = this.formatContent(data);

    // Apply position
    this.applyPosition(position, mergedConfig);

    // Show with delay
    setTimeout(() => {
      if (this.element) {
        this.element.style.display = 'block';
        this.element.style.opacity = '1';
        this.visible = true;
      }
    }, mergedConfig.showDelay);
  }

  hide(immediate?: boolean) {
    if (!this.element) return;

    const delay = immediate ? 0 : this.config.hideDelay;

    setTimeout(() => {
      if (this.element) {
        this.element.style.display = 'none';
        this.element.style.opacity = '0';
        this.visible = false;
      }
    }, delay);
  }

  updatePosition(position: { x: number; y: number }) {
    if (!this.element || !this.visible) return;
    this.applyPosition(position, this.config);
  }

  updateContent(data: any) {
    if (!this.element) return;
    this.element.innerHTML = this.formatContent(data);
  }

  isVisible(): boolean {
    return this.visible;
  }

  configure(config: any) {
    this.config = { ...this.config, ...config };
  }

  private formatContent(data: any): string {
    if (data.type === 'pod') {
      return `
        <div class="tooltip-header">Pod: ${data.name}</div>
        <div class="tooltip-body">
          <div>Namespace: ${data.namespace}</div>
          <div>Status: ${data.status}</div>
          <div>Node: ${data.nodeName}</div>
          <div>Ready: ${data.ready}</div>
          <div>Age: ${data.age}</div>
        </div>
      `;
    } else if (data.type === 'node') {
      return `
        <div class="tooltip-header">Node: ${data.name}</div>
        <div class="tooltip-body">
          <div>Status: ${data.status}</div>
          <div>Pods: ${data.podCount}/${data.maxPods}</div>
          <div>CPU: ${data.capacity.cpu}</div>
          <div>Memory: ${data.capacity.memory}</div>
          <div>OS: ${data.os}</div>
        </div>
      `;
    }
    return '';
  }

  private applyPosition(position: { x: number; y: number }, config: any) {
    if (!this.element) return;

    let x = position.x + config.offset.x;
    let y = position.y + config.offset.y;

    if (config.constrainToViewport) {
      const rect = this.element.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      // Keep within right edge
      if (x + rect.width > viewport.width) {
        x = position.x - rect.width - config.offset.x;
      }

      // Keep within bottom edge
      if (y + rect.height > viewport.height) {
        y = position.y - rect.height - config.offset.y;
      }

      // Keep within left edge
      x = Math.max(0, x);

      // Keep within top edge
      y = Math.max(0, y);
    }

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;
  }

  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}

describe('Tooltip Display', () => {
  let dom: JSDOM;
  let service: MockTooltipService;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><body></body>');
    global.document = dom.window.document as any;
    global.window = dom.window as any;
    service = new MockTooltipService();
  });

  afterEach(() => {
    service.destroy();
  });

  describe('Show/Hide Functionality', () => {
    it('should show tooltip with delay', async () => {
      const data = {
        type: 'pod',
        name: 'test-pod',
        namespace: 'default',
        status: 'Running',
        nodeName: 'node-1',
        ready: '1/1',
        age: '5m'
      };

      service.show(data, { x: 100, y: 100 });
      expect(service.isVisible()).toBe(false);

      await new Promise(resolve => setTimeout(resolve, 350));
      expect(service.isVisible()).toBe(true);
    });

    it('should hide tooltip immediately when requested', () => {
      service.show({ type: 'pod', name: 'test' }, { x: 0, y: 0 });
      service.hide(true);
      expect(service.isVisible()).toBe(false);
    });

    it('should hide tooltip with delay', async () => {
      service.configure({ hideDelay: 100 });
      service['visible'] = true; // Force visible state
      service.hide();

      expect(service.isVisible()).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 150));
      expect(service.isVisible()).toBe(false);
    });
  });

  describe('Tooltip Positioning', () => {
    it('should position tooltip with offset', () => {
      const element = service['element']!;
      service.show({ type: 'pod', name: 'test' }, { x: 100, y: 200 });

      // Wait for show delay
      setTimeout(() => {
        const left = parseInt(element.style.left);
        const top = parseInt(element.style.top);
        expect(left).toBe(110); // 100 + 10 offset
        expect(top).toBe(210);  // 200 + 10 offset
      }, 350);
    });

    it('should update position when cursor moves', () => {
      const element = service['element']!;
      service['visible'] = true;

      service.updatePosition({ x: 50, y: 75 });

      const left = parseInt(element.style.left);
      const top = parseInt(element.style.top);
      expect(left).toBe(60); // 50 + 10 offset
      expect(top).toBe(85);  // 75 + 10 offset
    });
  });

  describe('Content Formatting', () => {
    it('should format pod tooltip content', () => {
      const podData = {
        type: 'pod',
        name: 'nginx-pod',
        namespace: 'production',
        status: 'Running',
        nodeName: 'worker-1',
        ready: '2/2',
        age: '2d'
      };

      service.show(podData, { x: 0, y: 0 });
      const element = service['element']!;

      expect(element.innerHTML).toContain('Pod: nginx-pod');
      expect(element.innerHTML).toContain('Namespace: production');
      expect(element.innerHTML).toContain('Status: Running');
      expect(element.innerHTML).toContain('Ready: 2/2');
    });

    it('should format node tooltip content', () => {
      const nodeData = {
        type: 'node',
        name: 'master-1',
        status: 'Ready',
        podCount: 25,
        maxPods: 110,
        capacity: { cpu: '4', memory: '16Gi' },
        os: 'linux'
      };

      service.show(nodeData, { x: 0, y: 0 });
      const element = service['element']!;

      expect(element.innerHTML).toContain('Node: master-1');
      expect(element.innerHTML).toContain('Status: Ready');
      expect(element.innerHTML).toContain('Pods: 25/110');
      expect(element.innerHTML).toContain('CPU: 4');
      expect(element.innerHTML).toContain('Memory: 16Gi');
    });

    it('should update content dynamically', () => {
      const initialData = { type: 'pod', name: 'pod-1', status: 'Pending' };
      const updatedData = { type: 'pod', name: 'pod-1', status: 'Running' };

      service.show(initialData, { x: 0, y: 0 });
      let element = service['element']!;
      expect(element.innerHTML).toContain('Status: Pending');

      service.updateContent(updatedData);
      expect(element.innerHTML).toContain('Status: Running');
    });
  });

  describe('Viewport Constraints', () => {
    it('should keep tooltip within viewport bounds', () => {
      // Mock viewport dimensions
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      const element = service['element']!;
      // Mock element dimensions
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        width: 200,
        height: 100,
        top: 0,
        left: 0,
        right: 200,
        bottom: 100,
        x: 0,
        y: 0
      } as DOMRect);

      // Position near right edge
      service['applyPosition']({ x: 700, y: 100 }, service['config']);
      const left = parseInt(element.style.left);
      expect(left).toBeLessThan(600); // Should flip to left side

      // Position near bottom edge
      service['applyPosition']({ x: 100, y: 550 }, service['config']);
      const top = parseInt(element.style.top);
      expect(top).toBeLessThan(500); // Should flip to top side
    });

    it('should not allow negative positions', () => {
      const element = service['element']!;

      service['applyPosition']({ x: -50, y: -50 }, service['config']);

      const left = parseInt(element.style.left);
      const top = parseInt(element.style.top);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      const newConfig = {
        showDelay: 100,
        offset: { x: 20, y: 20 },
        maxWidth: 400
      };

      service.configure(newConfig);
      expect(service['config'].showDelay).toBe(100);
      expect(service['config'].offset.x).toBe(20);
      expect(service['config'].maxWidth).toBe(400);
    });

    it('should merge partial configuration', () => {
      const originalZIndex = service['config'].zIndex;

      service.configure({ showDelay: 50 });

      expect(service['config'].showDelay).toBe(50);
      expect(service['config'].zIndex).toBe(originalZIndex);
    });
  });

  describe('Visibility State', () => {
    it('should track visibility state correctly', async () => {
      expect(service.isVisible()).toBe(false);

      service.show({ type: 'pod', name: 'test' }, { x: 0, y: 0 });
      expect(service.isVisible()).toBe(false); // Still false due to delay

      await new Promise(resolve => setTimeout(resolve, 350));
      expect(service.isVisible()).toBe(true);

      service.hide(true);
      expect(service.isVisible()).toBe(false);
    });
  });
});