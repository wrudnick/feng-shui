// Main app — UI state, tool switching, simulation orchestration

import { CanvasManager } from './canvas.js';
import { Editor } from './editor.js';
import { Grid } from './grid.js';
import { Simulation } from './simulation.js';
import { ParticleSystem } from './particles.js';
import { Heatmap } from './heatmap.js';
import { BaguaMap } from './bagua.js';
import { FURNITURE_CATALOG } from './furniture.js';
import { getTemplate } from './templates.js';

// --- State ---
const canvas = new CanvasManager(document.getElementById('main-canvas'));
const editor = new Editor();
const grid = new Grid(200, 200);
const simulation = new Simulation(grid);
const particles = new ParticleSystem(grid);
const heatmap = new Heatmap(grid);
const bagua = new BaguaMap();

let showParticles = true;
let showHeatmap = false;
let showBagua = false;
let simulationActive = false;
let animFrameId = null;

// Cached room bounds and transform for visualization layers
let roomBounds = null;
let vizTransform = null;

// --- UI Setup ---

function setupToolbar() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.dataset.tool;
      editor.setTool(tool);
      updateStatus();

      // Show/hide furniture panel
      document.getElementById('furniture-panel').style.display =
        tool === 'furniture' ? 'block' : 'none';

      // Set cursor class on canvas container
      const container = document.getElementById('canvas-container');
      container.className = `tool-${tool}`;
    });
  });
}

function setupCollapsibleSections() {
  document.querySelectorAll('.section-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('collapsed');
      const content = toggle.nextElementSibling;
      if (content && content.classList.contains('section-content')) {
        content.classList.toggle('collapsed');
      }
    });
  });
}

function setupMobileToolbar() {
  const toggleBtn = document.getElementById('toolbar-toggle');
  const toolbar = document.getElementById('toolbar');

  // Create backdrop element for mobile overlay (fixed positioning, on body)
  const backdrop = document.createElement('div');
  backdrop.className = 'toolbar-backdrop';
  document.body.appendChild(backdrop);

  function openToolbar() {
    toolbar.classList.add('open');
    backdrop.classList.add('visible');
  }

  function closeToolbar() {
    toolbar.classList.remove('open');
    backdrop.classList.remove('visible');
  }

  toggleBtn.addEventListener('click', () => {
    if (toolbar.classList.contains('open')) {
      closeToolbar();
    } else {
      openToolbar();
    }
  });

  backdrop.addEventListener('click', closeToolbar);

  // Close toolbar when a tool is selected on mobile
  toolbar.addEventListener('click', (e) => {
    if (e.target.closest('.tool-btn') || e.target.closest('.template-btn')) {
      if (window.innerWidth <= 768) {
        closeToolbar();
      }
    }
  });
}

function setupFurnitureCatalog() {
  const container = document.getElementById('furniture-catalog');
  for (const item of FURNITURE_CATALOG) {
    const el = document.createElement('div');
    el.className = 'furniture-item';
    el.dataset.type = item.type;
    el.innerHTML = `<span class="furniture-swatch" style="background:${item.color}"></span>
      <span>${item.label}</span>`;
    el.title = item.description;
    el.addEventListener('click', () => {
      container.querySelectorAll('.furniture-item').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      editor.pendingFurnitureType = item.type;
    });
    container.appendChild(el);
  }
}

function setupTemplates() {
  document.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const template = getTemplate(btn.dataset.template);
      if (template) {
        editor.loadTemplate(template);
        simulationActive = false;
        particles.reset();
        // Center view on the template
        const bounds = editor.getRoomBounds();
        canvas.centerOn(bounds.x, bounds.y, bounds.width, bounds.height);
        setStatus(`Loaded: ${template.name} — running simulation...`);
        // Auto-simulate after a short delay so the view renders first
        setTimeout(() => runSimulation(), 100);
      }
    });
  });
}

function setupImageUpload() {
  document.getElementById('image-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      editor.setBackgroundImage(img);
      setStatus('Background image loaded — trace walls on top');
    };
    img.src = URL.createObjectURL(file);
  });
}

function setupHeaderButtons() {
  document.getElementById('btn-simulate').addEventListener('click', runSimulation);
  document.getElementById('btn-clear').addEventListener('click', () => {
    editor.clearAll();
    simulationActive = false;
    particles.reset();
    setStatus('Cleared');
  });
  document.getElementById('btn-undo').addEventListener('click', () => {
    if (editor.undo()) {
      simulationActive = false;
      setStatus('Undone');
    }
  });
  document.getElementById('btn-redo').addEventListener('click', () => {
    if (editor.redo()) {
      simulationActive = false;
      setStatus('Redone');
    }
  });

  // Viz toggles — sync header and mobile sidebar versions
  function syncToggle(headerId, mobileId, setter) {
    const header = document.getElementById(headerId);
    const mobile = document.getElementById(mobileId);
    header.addEventListener('change', (e) => {
      setter(e.target.checked);
      if (mobile) mobile.checked = e.target.checked;
    });
    if (mobile) {
      mobile.addEventListener('change', (e) => {
        setter(e.target.checked);
        header.checked = e.target.checked;
      });
    }
  }
  syncToggle('toggle-particles', 'toggle-particles-mobile', (v) => { showParticles = v; });
  syncToggle('toggle-heatmap', 'toggle-heatmap-mobile', (v) => { showHeatmap = v; });
  syncToggle('toggle-bagua', 'toggle-bagua-mobile', (v) => { showBagua = v; });
}

function setupCanvasEvents() {
  const el = canvas.canvas;

  // Track if middle button or space+click for panning
  let spaceDown = false;

  el.addEventListener('mousedown', (e) => {
    const rect = el.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Middle mouse, space+click, or move tool = pan
    if (e.button === 1 || (e.button === 0 && spaceDown) || (e.button === 0 && editor.currentTool === 'move')) {
      canvas.isPanning = true;
      canvas.panStartX = sx - canvas.panX;
      canvas.panStartY = sy - canvas.panY;
      el.style.cursor = 'grabbing';
      const container = document.getElementById('canvas-container');
      container.classList.add('panning');
      return;
    }

    if (e.button !== 0) return;

    const world = canvas.screenToWorld(sx, sy);
    const snapped = canvas.snapToGrid(world.x, world.y);
    editor.handleMouseDown(world.x, world.y, snapped.x, snapped.y);
  });

  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Pan
    if (canvas.isPanning) {
      canvas.panX = sx - canvas.panStartX;
      canvas.panY = sy - canvas.panStartY;
      return;
    }

    const world = canvas.screenToWorld(sx, sy);
    const snapped = canvas.snapToGrid(world.x, world.y);

    // Update preview for wall/door/window drawing
    editor.setPreviewPosition(snapped.x, snapped.y);

    // Handle drag
    editor.handleMouseMove(world.x, world.y);

    // Update status bar coords
    document.getElementById('status-coords').textContent =
      `${Math.round(world.x)}, ${Math.round(world.y)}`;
  });

  el.addEventListener('mouseup', (e) => {
    if (canvas.isPanning) {
      canvas.isPanning = false;
      el.style.cursor = '';
      const container = document.getElementById('canvas-container');
      container.classList.remove('panning');
      return;
    }
    editor.handleMouseUp();
  });

  el.addEventListener('dblclick', () => {
    editor.handleDoubleClick();
  });

  // Right click to cancel
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    editor.wallStart = null;
    editor.selectedItem = null;
  });

  // --- Touch events for mobile ---
  let touchState = {
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    pinchDist: 0,
    isPinching: false,
    isPanning: false,
    touchId: null,
  };

  function getTouchPos(touch) {
    const rect = el.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  function getPinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function getPinchCenter(touches) {
    const rect = el.getBoundingClientRect();
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
    };
  }

  el.addEventListener('touchstart', (e) => {
    e.preventDefault();

    if (e.touches.length === 2) {
      // Pinch zoom
      touchState.isPinching = true;
      touchState.isPanning = false;
      touchState.pinchDist = getPinchDist(e.touches);
      touchState.pinchCenter = getPinchCenter(e.touches);
      return;
    }

    if (e.touches.length !== 1) return;

    const pos = getTouchPos(e.touches[0]);
    touchState.active = true;
    touchState.startX = pos.x;
    touchState.startY = pos.y;
    touchState.lastX = pos.x;
    touchState.lastY = pos.y;
    touchState.touchId = e.touches[0].identifier;
    touchState.isPanning = false;
    touchState.moved = false;

    // If move tool, start panning immediately
    if (editor.currentTool === 'move') {
      touchState.isPanning = true;
      canvas.panStartX = pos.x - canvas.panX;
      canvas.panStartY = pos.y - canvas.panY;
    }
  }, { passive: false });

  el.addEventListener('touchmove', (e) => {
    e.preventDefault();

    // Pinch zoom
    if (touchState.isPinching && e.touches.length === 2) {
      const newDist = getPinchDist(e.touches);
      const center = getPinchCenter(e.touches);
      const scale = newDist / touchState.pinchDist;
      const oldZoom = canvas.zoom;
      canvas.zoom = Math.max(canvas.minZoom, Math.min(canvas.maxZoom, canvas.zoom * scale));
      canvas.panX = center.x - (center.x - canvas.panX) * (canvas.zoom / oldZoom);
      canvas.panY = center.y - (center.y - canvas.panY) * (canvas.zoom / oldZoom);
      touchState.pinchDist = newDist;
      return;
    }

    if (!touchState.active || e.touches.length !== 1) return;

    const pos = getTouchPos(e.touches[0]);
    const dx = pos.x - touchState.lastX;
    const dy = pos.y - touchState.lastY;

    // Detect if we should start panning (drag > threshold and not move tool)
    if (!touchState.isPanning && !touchState.moved) {
      const dist = Math.hypot(pos.x - touchState.startX, pos.y - touchState.startY);
      if (dist > 10) {
        touchState.moved = true;
        // On move tool, always pan. On other tools with two-finger reserved for pan,
        // single finger does the tool action. But for convenience, if no tool action
        // is actively drawing, we use single finger to pan on move tool.
        if (editor.currentTool === 'move') {
          touchState.isPanning = true;
          canvas.panStartX = touchState.startX - canvas.panX;
          canvas.panStartY = touchState.startY - canvas.panY;
        }
      }
    }

    if (touchState.isPanning) {
      canvas.panX = pos.x - canvas.panStartX;
      canvas.panY = pos.y - canvas.panStartY;
    } else {
      // Forward to editor as mouse move
      const world = canvas.screenToWorld(pos.x, pos.y);
      const snapped = canvas.snapToGrid(world.x, world.y);
      editor.setPreviewPosition(snapped.x, snapped.y);
      editor.handleMouseMove(world.x, world.y);

      document.getElementById('status-coords').textContent =
        `${Math.round(world.x)}, ${Math.round(world.y)}`;
    }

    touchState.lastX = pos.x;
    touchState.lastY = pos.y;
  }, { passive: false });

  el.addEventListener('touchend', (e) => {
    e.preventDefault();

    if (touchState.isPinching) {
      if (e.touches.length < 2) {
        touchState.isPinching = false;
      }
      return;
    }

    if (!touchState.active) return;

    // If it was a tap (no significant movement), treat as click
    if (!touchState.moved && !touchState.isPanning) {
      const pos = { x: touchState.startX, y: touchState.startY };
      const world = canvas.screenToWorld(pos.x, pos.y);
      const snapped = canvas.snapToGrid(world.x, world.y);
      editor.handleMouseDown(world.x, world.y, snapped.x, snapped.y);
      editor.handleMouseUp();
    } else {
      editor.handleMouseUp();
    }

    touchState.active = false;
    touchState.isPanning = false;
    touchState.moved = false;
  }, { passive: false });

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      spaceDown = true;
      e.preventDefault();
    }

    // Tool shortcuts
    if (!e.ctrlKey && !e.metaKey) {
      const toolMap = { v: 'select', w: 'wall', d: 'door', n: 'window', f: 'furniture', m: 'move', e: 'erase' };
      if (toolMap[e.key]) {
        document.querySelector(`[data-tool="${toolMap[e.key]}"]`)?.click();
        return;
      }
    }

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        editor.redo();
      } else {
        editor.undo();
      }
      simulationActive = false;
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      editor.redo();
      simulationActive = false;
      return;
    }

    editor.handleKeyDown(e.key);
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spaceDown = false;
  });
}

// --- Simulation ---

function runSimulation() {
  if (editor.walls.length === 0 && editor.doors.length === 0) {
    setStatus('Draw walls and a door first');
    return;
  }

  setStatus('Running simulation...');
  const btn = document.getElementById('btn-simulate');
  btn.disabled = true;

  // Use requestAnimationFrame to let the status update render
  requestAnimationFrame(() => {
    const state = editor.getSimulationState();
    roomBounds = state.roomBounds;
    simulation.rasterize(state);
    simulation.solve();

    // Compute viz transform
    updateVizTransform();

    // Set up particles
    particles.reset();
    particles.findSources();

    // Generate heatmap
    heatmap.generate();

    simulationActive = true;
    btn.disabled = false;

    setStatus('Simulation complete — toggle layers to visualize');
  });
}

function updateVizTransform() {
  if (!roomBounds) return;
  const screenTL = canvas.worldToScreen(roomBounds.x, roomBounds.y);
  const screenBR = canvas.worldToScreen(
    roomBounds.x + roomBounds.width,
    roomBounds.y + roomBounds.height
  );
  vizTransform = {
    offsetX: screenTL.x,
    offsetY: screenTL.y,
    scaleX: (screenBR.x - screenTL.x) / grid.width,
    scaleY: (screenBR.y - screenTL.y) / grid.height,
    roomWidth: roomBounds.width,
    roomHeight: roomBounds.height,
  };
}

// --- Status ---

function setStatus(msg) {
  document.getElementById('status-msg').textContent = msg;
}

function updateStatus() {
  document.getElementById('status-tool').textContent = editor.currentTool.charAt(0).toUpperCase() + editor.currentTool.slice(1);
  document.getElementById('status-zoom').textContent = canvas.getZoomPercent() + '%';
}

// --- Render Loop ---

function render() {
  canvas.clear();
  canvas.drawGrid();

  // Update viz transform every frame (for pan/zoom)
  if (simulationActive) {
    updateVizTransform();
  }

  // Draw heatmap (under the floor plan)
  if (simulationActive && showHeatmap && vizTransform) {
    heatmap.render(canvas.ctx, vizTransform);
  }

  // Draw bagua
  if (showBagua && (editor.walls.length > 0 || roomBounds)) {
    const rb = roomBounds || editor.getRoomBounds();
    const screenTL = canvas.worldToScreen(rb.x, rb.y);
    const screenBR = canvas.worldToScreen(rb.x + rb.width, rb.y + rb.height);
    bagua.render(canvas.ctx, rb, {
      offsetX: screenTL.x,
      offsetY: screenTL.y,
      scaleX: (screenBR.x - screenTL.x) / rb.width,
      scaleY: (screenBR.y - screenTL.y) / rb.height,
      roomWidth: rb.width,
      roomHeight: rb.height,
    });
  }

  // Draw floor plan
  canvas.beginWorldDraw();
  editor.render(canvas.ctx, canvas);
  canvas.endWorldDraw();

  // Draw particles (on top)
  if (simulationActive && showParticles && vizTransform) {
    particles.update(1);
    particles.render(canvas.ctx, vizTransform);
  }

  // Update status
  updateStatus();

  animFrameId = requestAnimationFrame(render);
}

// --- Init ---

function init() {
  setupToolbar();
  setupCollapsibleSections();
  setupMobileToolbar();
  setupFurnitureCatalog();
  setupTemplates();
  setupImageUpload();
  setupHeaderButtons();
  setupCanvasEvents();

  // Ensure canvas fills properly after CSS is applied
  requestAnimationFrame(() => {
    canvas.resize();
    canvas.panX = canvas.displayWidth / 2 - 225;
    canvas.panY = canvas.displayHeight / 2 - 200;
  });

  setStatus('Draw walls, place doors, then simulate');
  render();
}

init();
