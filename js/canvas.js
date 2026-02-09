// Canvas rendering manager — handles layers, zoom, pan, and coordinate transforms

export class CanvasManager {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');

    // View transform
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.minZoom = 0.2;
    this.maxZoom = 5;

    // Panning state
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    // Grid settings
    this.gridSize = 10;
    this.showGrid = true;

    this.resize();
    this._setupEvents();
  }

  resize() {
    const container = this.canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
  }

  _setupEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      const oldZoom = this.zoom;
      this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * (1 + delta)));

      // Zoom toward cursor
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      this.panX = mx - (mx - this.panX) * (this.zoom / oldZoom);
      this.panY = my - (my - this.panY) * (this.zoom / oldZoom);
    }, { passive: false });
  }

  // Convert screen coordinates to world coordinates
  screenToWorld(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  // Convert world coordinates to screen coordinates
  worldToScreen(wx, wy) {
    return {
      x: wx * this.zoom + this.panX,
      y: wy * this.zoom + this.panY,
    };
  }

  // Snap world coordinates to grid
  snapToGrid(wx, wy) {
    return {
      x: Math.round(wx / this.gridSize) * this.gridSize,
      y: Math.round(wy / this.gridSize) * this.gridSize,
    };
  }

  clear() {
    this.ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
    // Background
    this.ctx.fillStyle = '#0d0d1a';
    this.ctx.fillRect(0, 0, this.displayWidth, this.displayHeight);
  }

  drawGrid() {
    if (!this.showGrid) return;
    const ctx = this.ctx;
    const gs = this.gridSize * this.zoom;
    if (gs < 4) return; // Too zoomed out for grid

    const startX = this.panX % gs;
    const startY = this.panY % gs;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 0.5;

    for (let x = startX; x < this.displayWidth; x += gs) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.displayHeight);
    }
    for (let y = startY; y < this.displayHeight; y += gs) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.displayWidth, y);
    }
    ctx.stroke();
  }

  // Begin transformed drawing (world coordinates)
  beginWorldDraw() {
    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoom, this.zoom);
  }

  endWorldDraw() {
    this.ctx.restore();
  }

  // Get zoom percentage for status bar
  getZoomPercent() {
    return Math.round(this.zoom * 100);
  }

  // Center view on a bounding box
  centerOn(x, y, width, height) {
    const padding = 60;
    const scaleX = (this.displayWidth - padding * 2) / width;
    const scaleY = (this.displayHeight - padding * 2) / height;
    this.zoom = Math.min(scaleX, scaleY, 2);
    this.panX = (this.displayWidth - width * this.zoom) / 2 - x * this.zoom;
    this.panY = (this.displayHeight - height * this.zoom) / 2 - y * this.zoom;
  }
}
