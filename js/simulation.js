// Chi flow simulation using Laplace equation solver
// Computes potential field via Jacobi iteration, then derives velocity field

export class Simulation {
  constructor(grid) {
    this.grid = grid;
    this.iterations = 800;
    this.converged = false;
  }

  // Rasterize the editor state onto the simulation grid
  rasterize(state) {
    const g = this.grid;
    g.clear();

    const { walls, doors, windows, furniture, roomBounds } = state;
    const scaleX = g.width / roomBounds.width;
    const scaleY = g.height / roomBounds.height;

    const toGrid = (wx, wy) => ({
      gx: Math.round((wx - roomBounds.x) * scaleX),
      gy: Math.round((wy - roomBounds.y) * scaleY),
    });

    // Draw all outer edges as walls first — fill border
    for (let x = 0; x < g.width; x++) {
      g.setWall(x, 0);
      g.setWall(x, g.height - 1);
    }
    for (let y = 0; y < g.height; y++) {
      g.setWall(0, y);
      g.setWall(g.width - 1, y);
    }

    // Rasterize walls using Bresenham's line
    for (const wall of walls) {
      const a = toGrid(wall.x1, wall.y1);
      const b = toGrid(wall.x2, wall.y2);
      this.rasterizeLine(a.gx, a.gy, b.gx, b.gy, (x, y) => {
        g.setWall(x, y);
        // Thicken walls by 1 pixel each direction
        g.setWall(x + 1, y);
        g.setWall(x - 1, y);
        g.setWall(x, y + 1);
        g.setWall(x, y - 1);
      });
    }

    // Carve doors as sources (high potential chi inflow)
    for (const door of doors) {
      const a = toGrid(door.x1, door.y1);
      const b = toGrid(door.x2, door.y2);
      this.rasterizeLine(a.gx, a.gy, b.gx, b.gy, (x, y) => {
        // Clear the wall and set as source
        if (g.inBounds(x, y)) {
          g.cells[g.idx(x, y)] = 0;
          g.setSource(x, y, 1.0);
        }
        // Also clear adjacent cells to ensure gap
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (g.inBounds(nx, ny)) {
            g.cells[g.idx(nx, ny)] = 0;
            g.setSource(nx, ny, 0.8);
          }
        }
      });
    }

    // Windows as secondary sources
    for (const win of windows) {
      const a = toGrid(win.x1, win.y1);
      const b = toGrid(win.x2, win.y2);
      this.rasterizeLine(a.gx, a.gy, b.gx, b.gy, (x, y) => {
        if (g.inBounds(x, y)) {
          g.cells[g.idx(x, y)] = 0;
          g.setSource(x, y, 0.5);
        }
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (g.inBounds(nx, ny)) {
            g.cells[g.idx(nx, ny)] = 0;
            g.setSource(nx, ny, 0.3);
          }
        }
      });
    }

    // Rasterize furniture as obstacles
    if (furniture) {
      for (const item of furniture) {
        const tl = toGrid(item.x, item.y);
        const br = toGrid(item.x + item.width, item.y + item.height);
        const resistance = item.flowResistance || 0.8;
        const modifier = item.flowModifier || 0;

        for (let gy = Math.max(1, tl.gy); gy <= Math.min(g.height - 2, br.gy); gy++) {
          for (let gx = Math.max(1, tl.gx); gx <= Math.min(g.width - 2, br.gx); gx++) {
            if (item.type === 'mirror') {
              // Mirrors don't block, they enhance
              g.setFlowModifier(gx, gy, 0.3);
            } else if (item.type === 'plant') {
              g.setFlowModifier(gx, gy, 0.2);
            } else {
              g.setObstacle(gx, gy, resistance);
            }
          }
        }

        // Poison arrows from sharp corners for tables/desks
        if (item.poisonArrow) {
          const corners = [
            toGrid(item.x, item.y),
            toGrid(item.x + item.width, item.y),
            toGrid(item.x, item.y + item.height),
            toGrid(item.x + item.width, item.y + item.height),
          ];
          for (const c of corners) {
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                g.setFlowModifier(c.gx + dx, c.gy + dy, -0.3);
              }
            }
          }
        }
      }
    }
  }

  rasterizeLine(x0, y0, x1, y1, callback) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      callback(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  // Main solve: Jacobi iteration for Laplace equation
  solve() {
    const g = this.grid;
    const w = g.width, h = g.height;
    const phi = g.potential;
    const cells = g.cells;
    const sources = g.sources;
    const mods = g.flowModifier;

    // Initialize potential: sources get high values
    for (let i = 0; i < w * h; i++) {
      if (sources[i] > 0) {
        phi[i] = sources[i] * 100;
      } else {
        phi[i] = 0;
      }
    }

    // Set center of room as sink (low potential) to create flow
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const sinkRadius = Math.floor(Math.min(w, h) * 0.15);
    for (let dy = -sinkRadius; dy <= sinkRadius; dy++) {
      for (let dx = -sinkRadius; dx <= sinkRadius; dx++) {
        if (dx * dx + dy * dy <= sinkRadius * sinkRadius) {
          const sx = cx + dx, sy = cy + dy;
          if (g.inBounds(sx, sy) && cells[g.idx(sx, sy)] < 1) {
            // Only set as sink if not already a source
            if (sources[g.idx(sx, sy)] <= 0) {
              phi[g.idx(sx, sy)] = -10;
            }
          }
        }
      }
    }

    // Jacobi iteration
    const temp = new Float32Array(w * h);
    for (let iter = 0; iter < this.iterations; iter++) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;

          // Skip walls
          if (cells[i] >= 1) {
            temp[i] = phi[i];
            continue;
          }

          // Fixed sources/sinks
          if (sources[i] !== 0) {
            temp[i] = phi[i];
            continue;
          }

          // If it's a sink cell, keep it fixed
          const dxc = x - cx, dyc = y - cy;
          if (dxc * dxc + dyc * dyc <= sinkRadius * sinkRadius && sources[i] <= 0) {
            temp[i] = phi[i];
            continue;
          }

          // Jacobi relaxation
          let sum = phi[i - 1] + phi[i + 1] + phi[i - w] + phi[i + w];
          let count = 4;

          // Obstacles partially block flow
          if (cells[i] > 0 && cells[i] < 1) {
            const resistance = cells[i];
            temp[i] = (1 - resistance) * (sum / count) + resistance * phi[i];
          } else {
            temp[i] = sum / count;
          }

          // Flow modifiers
          if (mods[i] > 0) {
            // Enhancement: pull potential toward source average
            temp[i] *= (1 + mods[i] * 0.1);
          } else if (mods[i] < 0) {
            // Poison arrow: amplify gradients
            temp[i] *= (1 + mods[i] * 0.05);
          }
        }
      }

      // Swap
      phi.set(temp);
    }

    // Compute velocity field from gradient
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (cells[i] >= 1) {
          g.vx[i] = 0;
          g.vy[i] = 0;
          g.speed[i] = 0;
          continue;
        }

        g.vx[i] = -(phi[i + 1] - phi[i - 1]) / 2;
        g.vy[i] = -(phi[i + w] - phi[i - w]) / 2;

        // Obstacles slow flow
        if (cells[i] > 0 && cells[i] < 1) {
          const factor = 1 - cells[i];
          g.vx[i] *= factor;
          g.vy[i] *= factor;
        }

        g.speed[i] = Math.sqrt(g.vx[i] * g.vx[i] + g.vy[i] * g.vy[i]);
      }
    }

    this.converged = true;
  }
}
