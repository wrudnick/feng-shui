// Floor plan editor — wall drawing, door/window placement, furniture, selection
// Manages all the "objects" in the floor plan

import { createFurnitureInstance } from './furniture.js';

export class Editor {
  constructor() {
    // Scene objects
    this.walls = [];
    this.doors = [];
    this.windows = [];
    this.furniture = [];
    this.backgroundImage = null;
    this.backgroundOpacity = 0.3;

    // Drawing state
    this.currentTool = 'select';
    this.wallStart = null;     // {x, y} for wall being drawn
    this.selectedItem = null;  // { type: 'wall'|'door'|'window'|'furniture', index }
    this.dragOffset = null;
    this.isDragging = false;

    // Furniture placement
    this.pendingFurnitureType = null;

    // Undo/redo
    this.undoStack = [];
    this.redoStack = [];
  }

  saveState() {
    this.undoStack.push({
      walls: JSON.parse(JSON.stringify(this.walls)),
      doors: JSON.parse(JSON.stringify(this.doors)),
      windows: JSON.parse(JSON.stringify(this.windows)),
      furniture: JSON.parse(JSON.stringify(this.furniture)),
    });
    this.redoStack = [];
    // Limit stack size
    if (this.undoStack.length > 50) this.undoStack.shift();
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push({
      walls: JSON.parse(JSON.stringify(this.walls)),
      doors: JSON.parse(JSON.stringify(this.doors)),
      windows: JSON.parse(JSON.stringify(this.windows)),
      furniture: JSON.parse(JSON.stringify(this.furniture)),
    });
    const state = this.undoStack.pop();
    this.walls = state.walls;
    this.doors = state.doors;
    this.windows = state.windows;
    this.furniture = state.furniture;
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push({
      walls: JSON.parse(JSON.stringify(this.walls)),
      doors: JSON.parse(JSON.stringify(this.doors)),
      windows: JSON.parse(JSON.stringify(this.windows)),
      furniture: JSON.parse(JSON.stringify(this.furniture)),
    });
    const state = this.redoStack.pop();
    this.walls = state.walls;
    this.doors = state.doors;
    this.windows = state.windows;
    this.furniture = state.furniture;
    return true;
  }

  clearAll() {
    this.saveState();
    this.walls = [];
    this.doors = [];
    this.windows = [];
    this.furniture = [];
    this.wallStart = null;
    this.selectedItem = null;
    this.backgroundImage = null;
  }

  setTool(tool) {
    this.currentTool = tool;
    this.wallStart = null;
    this.selectedItem = null;
    this.isDragging = false;
    if (tool !== 'furniture') {
      this.pendingFurnitureType = null;
    }
  }

  loadTemplate(template) {
    this.saveState();
    this.walls = [...template.walls];
    this.doors = [...template.doors];
    this.windows = [...template.windows];
    this.furniture = template.furniture ? template.furniture.map(f => ({ ...f })) : [];
    this.wallStart = null;
    this.selectedItem = null;
  }

  setBackgroundImage(img) {
    this.backgroundImage = img;
  }

  // Get bounding box of all walls/objects for simulation
  getRoomBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const w of this.walls) {
      minX = Math.min(minX, w.x1, w.x2);
      minY = Math.min(minY, w.y1, w.y2);
      maxX = Math.max(maxX, w.x1, w.x2);
      maxY = Math.max(maxY, w.y1, w.y2);
    }
    for (const d of this.doors) {
      minX = Math.min(minX, d.x1, d.x2);
      minY = Math.min(minY, d.y1, d.y2);
      maxX = Math.max(maxX, d.x1, d.x2);
      maxY = Math.max(maxY, d.y1, d.y2);
    }

    if (minX === Infinity) {
      return { x: 0, y: 0, width: 500, height: 400 };
    }

    const pad = 20;
    return {
      x: minX - pad,
      y: minY - pad,
      width: maxX - minX + pad * 2,
      height: maxY - minY + pad * 2,
    };
  }

  // Get state for simulation
  getSimulationState() {
    return {
      walls: this.walls,
      doors: this.doors,
      windows: this.windows,
      furniture: this.furniture,
      roomBounds: this.getRoomBounds(),
    };
  }

  // --- Mouse event handlers ---

  handleMouseDown(wx, wy, snappedX, snappedY) {
    switch (this.currentTool) {
      case 'wall':
        if (!this.wallStart) {
          this.wallStart = { x: snappedX, y: snappedY };
        } else {
          this.saveState();
          this.walls.push({
            x1: this.wallStart.x, y1: this.wallStart.y,
            x2: snappedX, y2: snappedY,
          });
          this.wallStart = { x: snappedX, y: snappedY }; // chain walls
        }
        return { action: 'wall_point' };

      case 'door':
        if (!this.wallStart) {
          this.wallStart = { x: snappedX, y: snappedY };
        } else {
          this.saveState();
          this.doors.push({
            x1: this.wallStart.x, y1: this.wallStart.y,
            x2: snappedX, y2: snappedY,
          });
          this.wallStart = null;
        }
        return { action: 'door_point' };

      case 'window':
        if (!this.wallStart) {
          this.wallStart = { x: snappedX, y: snappedY };
        } else {
          this.saveState();
          this.windows.push({
            x1: this.wallStart.x, y1: this.wallStart.y,
            x2: snappedX, y2: snappedY,
          });
          this.wallStart = null;
        }
        return { action: 'window_point' };

      case 'furniture':
        if (this.pendingFurnitureType) {
          this.saveState();
          const item = createFurnitureInstance(this.pendingFurnitureType, snappedX, snappedY);
          if (item) {
            // Center on click point
            item.x = snappedX - item.width / 2;
            item.y = snappedY - item.height / 2;
            this.furniture.push(item);
            return { action: 'furniture_placed', item };
          }
        }
        return { action: 'none' };

      case 'select':
        return this._handleSelect(wx, wy);

      case 'erase':
        return this._handleErase(wx, wy);
    }
    return { action: 'none' };
  }

  handleMouseMove(wx, wy) {
    if (this.currentTool === 'select' && this.isDragging && this.selectedItem) {
      const sel = this.selectedItem;
      if (sel.type === 'furniture') {
        const item = this.furniture[sel.index];
        if (item && this.dragOffset) {
          item.x = wx - this.dragOffset.x;
          item.y = wy - this.dragOffset.y;
          return true;
        }
      }
    }
    return false;
  }

  handleMouseUp() {
    if (this.isDragging && this.selectedItem) {
      this.isDragging = false;
      return true;
    }
    return false;
  }

  handleDoubleClick() {
    // Finish wall chain
    if (this.currentTool === 'wall' && this.wallStart) {
      this.wallStart = null;
      return true;
    }
    return false;
  }

  handleKeyDown(key) {
    if (key === 'Escape') {
      this.wallStart = null;
      this.selectedItem = null;
      this.isDragging = false;
      return true;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (this.selectedItem) {
        this.saveState();
        const sel = this.selectedItem;
        if (sel.type === 'wall') this.walls.splice(sel.index, 1);
        else if (sel.type === 'door') this.doors.splice(sel.index, 1);
        else if (sel.type === 'window') this.windows.splice(sel.index, 1);
        else if (sel.type === 'furniture') this.furniture.splice(sel.index, 1);
        this.selectedItem = null;
        return true;
      }
    }
    // Rotate furniture
    if (key === 'r' || key === 'R') {
      if (this.selectedItem && this.selectedItem.type === 'furniture') {
        this.saveState();
        const item = this.furniture[this.selectedItem.index];
        if (item) {
          // Swap width/height for 90-degree rotation
          const tmp = item.width;
          item.width = item.height;
          item.height = tmp;
          item.rotation = ((item.rotation || 0) + 90) % 360;
          return true;
        }
      }
    }
    return false;
  }

  _handleSelect(wx, wy) {
    // Check furniture first (topmost)
    for (let i = this.furniture.length - 1; i >= 0; i--) {
      const f = this.furniture[i];
      if (wx >= f.x && wx <= f.x + f.width && wy >= f.y && wy <= f.y + f.height) {
        this.selectedItem = { type: 'furniture', index: i };
        this.dragOffset = { x: wx - f.x, y: wy - f.y };
        this.isDragging = true;
        return { action: 'selected', item: this.selectedItem };
      }
    }

    // Check doors
    for (let i = this.doors.length - 1; i >= 0; i--) {
      if (this._nearLine(wx, wy, this.doors[i], 8)) {
        this.selectedItem = { type: 'door', index: i };
        return { action: 'selected', item: this.selectedItem };
      }
    }

    // Check windows
    for (let i = this.windows.length - 1; i >= 0; i--) {
      if (this._nearLine(wx, wy, this.windows[i], 8)) {
        this.selectedItem = { type: 'window', index: i };
        return { action: 'selected', item: this.selectedItem };
      }
    }

    // Check walls
    for (let i = this.walls.length - 1; i >= 0; i--) {
      if (this._nearLine(wx, wy, this.walls[i], 8)) {
        this.selectedItem = { type: 'wall', index: i };
        return { action: 'selected', item: this.selectedItem };
      }
    }

    this.selectedItem = null;
    return { action: 'deselected' };
  }

  _handleErase(wx, wy) {
    // Check furniture
    for (let i = this.furniture.length - 1; i >= 0; i--) {
      const f = this.furniture[i];
      if (wx >= f.x && wx <= f.x + f.width && wy >= f.y && wy <= f.y + f.height) {
        this.saveState();
        this.furniture.splice(i, 1);
        return { action: 'erased', type: 'furniture' };
      }
    }

    // Check doors
    for (let i = this.doors.length - 1; i >= 0; i--) {
      if (this._nearLine(wx, wy, this.doors[i], 8)) {
        this.saveState();
        this.doors.splice(i, 1);
        return { action: 'erased', type: 'door' };
      }
    }

    // Check windows
    for (let i = this.windows.length - 1; i >= 0; i--) {
      if (this._nearLine(wx, wy, this.windows[i], 8)) {
        this.saveState();
        this.windows.splice(i, 1);
        return { action: 'erased', type: 'window' };
      }
    }

    // Check walls
    for (let i = this.walls.length - 1; i >= 0; i--) {
      if (this._nearLine(wx, wy, this.walls[i], 8)) {
        this.saveState();
        this.walls.splice(i, 1);
        return { action: 'erased', type: 'wall' };
      }
    }

    return { action: 'none' };
  }

  _nearLine(px, py, line, threshold) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - line.x1, py - line.y1) < threshold;

    let t = ((px - line.x1) * dx + (py - line.y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = line.x1 + t * dx;
    const cy = line.y1 + t * dy;
    return Math.hypot(px - cx, py - cy) < threshold;
  }

  // --- Rendering ---

  render(ctx, canvasManager) {
    // Background image
    if (this.backgroundImage) {
      ctx.globalAlpha = this.backgroundOpacity;
      ctx.drawImage(this.backgroundImage, 0, 0);
      ctx.globalAlpha = 1;
    }

    // Walls
    ctx.strokeStyle = '#aabbcc';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < this.walls.length; i++) {
      const w = this.walls[i];
      const selected = this.selectedItem?.type === 'wall' && this.selectedItem.index === i;
      ctx.strokeStyle = selected ? '#e94560' : '#aabbcc';
      ctx.lineWidth = selected ? 5 : 4;
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
    }

    // Doors
    for (let i = 0; i < this.doors.length; i++) {
      const d = this.doors[i];
      const selected = this.selectedItem?.type === 'door' && this.selectedItem.index === i;
      ctx.strokeStyle = selected ? '#e94560' : '#4ade80';
      ctx.lineWidth = selected ? 5 : 6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(d.x1, d.y1);
      ctx.lineTo(d.x2, d.y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Door arc
      const mx = (d.x1 + d.x2) / 2;
      const my = (d.y1 + d.y2) / 2;
      const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) / 2;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.arc(mx, my, len, 0, Math.PI, false);
      ctx.stroke();
    }

    // Windows
    for (let i = 0; i < this.windows.length; i++) {
      const w = this.windows[i];
      const selected = this.selectedItem?.type === 'window' && this.selectedItem.index === i;
      ctx.strokeStyle = selected ? '#e94560' : '#53d8fb';
      ctx.lineWidth = selected ? 5 : 3;
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();

      // Window hash marks
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len * 4;
      const ny = dx / len * 4;
      const steps = Math.max(2, Math.floor(len / 10));
      ctx.strokeStyle = 'rgba(83, 216, 251, 0.4)';
      ctx.lineWidth = 1;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const px = w.x1 + dx * t;
        const py = w.y1 + dy * t;
        ctx.beginPath();
        ctx.moveTo(px - nx, py - ny);
        ctx.lineTo(px + nx, py + ny);
        ctx.stroke();
      }
    }

    // Furniture
    for (let i = 0; i < this.furniture.length; i++) {
      const f = this.furniture[i];
      const selected = this.selectedItem?.type === 'furniture' && this.selectedItem.index === i;

      ctx.fillStyle = f.color || '#666';
      ctx.globalAlpha = 0.7;
      ctx.fillRect(f.x, f.y, f.width, f.height);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = selected ? '#e94560' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(f.x, f.y, f.width, f.height);

      // Label
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.label || f.type, f.x + f.width / 2, f.y + f.height / 2);
    }

    // Wall drawing preview
    if (this.wallStart && (this.currentTool === 'wall' || this.currentTool === 'door' || this.currentTool === 'window')) {
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = this.currentTool === 'wall' ? '#aabbcc' :
                         this.currentTool === 'door' ? '#4ade80' : '#53d8fb';
      ctx.lineWidth = 2;
      ctx.moveTo(this.wallStart.x, this.wallStart.y);
      ctx.lineTo(this._previewX || this.wallStart.x, this._previewY || this.wallStart.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  setPreviewPosition(wx, wy) {
    this._previewX = wx;
    this._previewY = wy;
  }
}
