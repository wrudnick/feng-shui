// Chi flow simulation using Laplace equation solver
// Computes potential field via SOR iteration, then derives velocity field

export class Simulation {
  constructor(grid) {
    this.grid = grid;
    this.iterations = 600;
    this.omega = 1.7; // SOR relaxation factor (faster convergence than Jacobi)
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
        if (g.inBounds(x, y)) {
          g.cells[g.idx(x, y)] = 0;
          g.setSource(x, y, 1.0);
        }
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (g.inBounds(nx, ny)) {
            g.cells[g.idx(nx, ny)] = 0;
            g.setSource(nx, ny, 0.8);
          }
        }
      });
    }

    // Windows as weaker sources
    for (const win of windows) {
      const a = toGrid(win.x1, win.y1);
      const b = toGrid(win.x2, win.y2);
      this.rasterizeLine(a.gx, a.gy, b.gx, b.gy, (x, y) => {
        if (g.inBounds(x, y)) {
          g.cells[g.idx(x, y)] = 0;
          g.setSource(x, y, 0.4);
        }
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x + dx, ny = y + dy;
          if (g.inBounds(nx, ny)) {
            g.cells[g.idx(nx, ny)] = 0;
            g.setSource(nx, ny, 0.2);
          }
        }
      });
    }

    // Rasterize furniture as obstacles
    if (furniture) {
      for (const item of furniture) {
        const tl = toGrid(item.x, item.y);
        const br = toGrid(item.x + item.width, item.y + item.height);

        for (let gy = Math.max(1, tl.gy); gy <= Math.min(g.height - 2, br.gy); gy++) {
          for (let gx = Math.max(1, tl.gx); gx <= Math.min(g.width - 2, br.gx); gx++) {
            if (item.type === 'mirror') {
              // Mirrors act as local sources — redirect chi
              g.setSource(gx, gy, 0.3);
            } else if (item.type === 'plant') {
              // Plants gently enhance flow
              g.setFlowModifier(gx, gy, 0.5);
            } else if (item.type === 'rug') {
              // Rugs slightly slow and ground energy
              g.setObstacle(gx, gy, 0.15);
              g.setFlowModifier(gx, gy, 0.2);
            } else {
              g.setObstacle(gx, gy, item.flowResistance || 0.8);
            }
          }
        }

        // Poison arrows from sharp corners — create fast disruptive flow
        if (item.poisonArrow) {
          const corners = [
            toGrid(item.x, item.y),
            toGrid(item.x + item.width, item.y),
            toGrid(item.x, item.y + item.height),
            toGrid(item.x + item.width, item.y + item.height),
          ];
          for (const c of corners) {
            for (let dy = -3; dy <= 3; dy++) {
              for (let dx = -3; dx <= 3; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= 3) {
                  g.setFlowModifier(c.gx + dx, c.gy + dy, -0.6 * (1 - dist / 4));
                }
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

  // Main solve: SOR iteration for Laplace equation
  // Sources (doors/windows) at high potential, walls at 0 → natural flow from entry to room interior
  solve() {
    const g = this.grid;
    const w = g.width, h = g.height;
    const phi = g.potential;
    const cells = g.cells;
    const sources = g.sources;
    const mods = g.flowModifier;
    const omega = this.omega;

    // Initialize potential
    for (let i = 0; i < w * h; i++) {
      if (sources[i] > 0) {
        phi[i] = sources[i] * 100; // Source potential proportional to strength
      } else {
        phi[i] = 0;
      }
    }

    // Identify far corners/edges from doors as gentle sinks for cross-room flow
    // Find average door position
    let doorSumX = 0, doorSumY = 0, doorCount = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        if (sources[y * w + x] > 0.5) {
          doorSumX += x;
          doorSumY += y;
          doorCount++;
        }
      }
    }

    if (doorCount > 0) {
      const doorAvgX = doorSumX / doorCount;
      const doorAvgY = doorSumY / doorCount;

      // Create sinks at the wall region farthest from the door
      // This creates natural cross-room flow
      const maxDist = Math.sqrt(w * w + h * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (cells[i] >= 1 || sources[i] > 0) continue;

          // Check if this cell is adjacent to a wall (near the room edges)
          const nearWall =
            (cells[i - 1] >= 1 || cells[i + 1] >= 1 ||
             cells[i - w] >= 1 || cells[i + w] >= 1);

          if (nearWall) {
            const dist = Math.sqrt((x - doorAvgX) ** 2 + (y - doorAvgY) ** 2);
            const distRatio = dist / maxDist;
            // Farther from door = stronger sink (pulls chi across the room)
            if (distRatio > 0.3) {
              const sinkStrength = -8 * distRatio * distRatio;
              phi[i] = sinkStrength;
              sources[i] = sinkStrength / 100; // Mark as fixed
            }
          }
        }
      }
    }

    // SOR iteration
    for (let iter = 0; iter < this.iterations; iter++) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;

          // Skip walls
          if (cells[i] >= 1) continue;

          // Fixed sources/sinks don't change
          if (sources[i] !== 0) continue;

          // Laplace average of 4 neighbors
          const avg = (phi[i - 1] + phi[i + 1] + phi[i - w] + phi[i + w]) / 4;

          // Obstacles partially block flow
          let newVal;
          if (cells[i] > 0 && cells[i] < 1) {
            const resistance = cells[i];
            newVal = (1 - resistance) * avg + resistance * phi[i];
          } else {
            newVal = avg;
          }

          // Flow modifiers — enhance or disrupt potential
          if (mods[i] > 0) {
            // Positive: plants/mirrors boost local potential (attract chi)
            newVal += mods[i] * 2.0;
          } else if (mods[i] < 0) {
            // Negative: poison arrows amplify local gradient (create turbulence)
            newVal += mods[i] * 3.0;
          }

          // SOR update (converges faster than pure Jacobi)
          phi[i] = phi[i] + omega * (newVal - phi[i]);
        }
      }
    }

    // Compute velocity field from potential gradient
    // v = -∇φ (flow goes from high potential to low)
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (cells[i] >= 1) {
          g.vx[i] = 0;
          g.vy[i] = 0;
          g.speed[i] = 0;
          continue;
        }

        // Central difference gradient
        g.vx[i] = -(phi[i + 1] - phi[i - 1]) / 2;
        g.vy[i] = -(phi[i + w] - phi[i - w]) / 2;

        // Obstacles slow flow proportionally
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
