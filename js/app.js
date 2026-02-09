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

  // Viz toggles
  document.getElementById('toggle-particles').addEventListener('change', (e) => {
    showParticles = e.target.checked;
  });
  document.getElementById('toggle-heatmap').addEventListener('change', (e) => {
    showHeatmap = e.target.checked;
  });
  document.getElementById('toggle-bagua').addEventListener('change', (e) => {
    showBagua = e.target.checked;
  });
}

function setupCanvasEvents() {
  const el = canvas.canvas;

  // Track if middle button or space+click for panning
  let spaceDown = false;

  el.addEventListener('mousedown', (e) => {
    const rect = el.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Middle mouse or space+click = pan
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      canvas.isPanning = true;
      canvas.panStartX = sx - canvas.panX;
      canvas.panStartY = sy - canvas.panY;
      el.style.cursor = 'grabbing';
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

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      spaceDown = true;
      e.preventDefault();
    }

    // Tool shortcuts
    if (!e.ctrlKey && !e.metaKey) {
      const toolMap = { v: 'select', w: 'wall', d: 'door', n: 'window', f: 'furniture', e: 'erase' };
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

    // Generate tips
    generateTips();

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

// --- Tips ---

function generateTips() {
  const panel = document.getElementById('info-panel');
  const content = document.getElementById('tips-content');
  panel.style.display = 'block';

  const maxSpeed = grid.getMaxSpeed();
  if (maxSpeed === 0) {
    content.innerHTML = '<div class="tip-item"><span class="tip-warn">No flow detected. Make sure you have at least one door.</span></div>';
    return;
  }

  const tips = [];

  // Analyze flow coverage
  let totalCells = 0;
  let flowingCells = 0;
  let stagnantCells = 0;
  const stagnantThreshold = maxSpeed * 0.1;

  for (let y = 1; y < grid.height - 1; y++) {
    for (let x = 1; x < grid.width - 1; x++) {
      if (!grid.isWall(x, y)) {
        totalCells++;
        const speed = grid.getSpeed(x, y);
        if (speed > stagnantThreshold) flowingCells++;
        else stagnantCells++;
      }
    }
  }

  const coverage = flowingCells / totalCells;
  if (coverage > 0.6) {
    tips.push({ label: 'Flow Coverage', text: `${Math.round(coverage * 100)}% — Good chi circulation`, cls: 'tip-good' });
  } else if (coverage > 0.3) {
    tips.push({ label: 'Flow Coverage', text: `${Math.round(coverage * 100)}% — Moderate. Consider repositioning furniture.`, cls: 'tip-warn' });
  } else {
    tips.push({ label: 'Flow Coverage', text: `${Math.round(coverage * 100)}% — Poor. Too many obstructions blocking flow.`, cls: 'tip-bad' });
  }

  // Check for stagnation
  const stagnantPct = stagnantCells / totalCells;
  if (stagnantPct > 0.5) {
    tips.push({ label: 'Stagnation', text: 'High stagnation areas. Add a plant or mirror to activate chi.', cls: 'tip-bad' });
  }

  // Door count advice
  if (editor.doors.length === 0) {
    tips.push({ label: 'No Door', text: 'Add a door — chi needs an entry point!', cls: 'tip-bad' });
  } else if (editor.doors.length >= 2) {
    tips.push({ label: 'Multiple Doors', text: 'Multiple entries create cross-flow. Ensure pathways are clear.', cls: 'tip-warn' });
  }

  // Window advice
  if (editor.windows.length === 0) {
    tips.push({ label: 'Windows', text: 'Windows bring secondary chi. Consider adding them.', cls: 'tip-warn' });
  }

  // Furniture in center
  const bounds = roomBounds;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  for (const f of editor.furniture) {
    if (f.x < cx + 40 && f.x + f.width > cx - 40 &&
        f.y < cy + 40 && f.y + f.height > cy - 40) {
      tips.push({ label: 'Center Blocked', text: `"${f.label}" is near room center. Keep the center open for health energy.`, cls: 'tip-warn' });
      break;
    }
  }

  // Poison arrows
  const poisonItems = editor.furniture.filter(f => f.poisonArrow);
  if (poisonItems.length > 0) {
    tips.push({ label: 'Poison Arrows', text: `Sharp corners on ${poisonItems.map(f => f.label).join(', ')}. Round tables are preferred.`, cls: 'tip-warn' });
  }

  content.innerHTML = tips.map(t =>
    `<div class="tip-item"><span class="tip-label ${t.cls}">${t.label}</span><br>${t.text}</div>`
  ).join('');
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
  setupFurnitureCatalog();
  setupTemplates();
  setupImageUpload();
  setupHeaderButtons();
  setupCanvasEvents();

  // Center canvas
  canvas.panX = canvas.displayWidth / 2 - 225;
  canvas.panY = canvas.displayHeight / 2 - 200;

  setStatus('Draw walls, place doors, then simulate');
  render();
}

init();
