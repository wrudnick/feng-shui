// Spatial grid for the simulation
// Each cell stores: wall (boolean), source strength, obstacle info

export class Grid {
  constructor(width = 200, height = 200) {
    this.width = width;
    this.height = height;
    this.cells = new Float32Array(width * height); // 0 = open, 1 = wall, 0.5 = obstacle
    this.sources = new Float32Array(width * height); // positive = source, negative = sink
    this.potential = new Float32Array(width * height);
    this.vx = new Float32Array(width * height);
    this.vy = new Float32Array(width * height);
    this.speed = new Float32Array(width * height); // velocity magnitude
    this.flowModifier = new Float32Array(width * height); // feng shui modifiers
  }

  idx(x, y) {
    return y * this.width + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  clear() {
    this.cells.fill(0);
    this.sources.fill(0);
    this.potential.fill(0);
    this.vx.fill(0);
    this.vy.fill(0);
    this.speed.fill(0);
    this.flowModifier.fill(0);
  }

  setWall(x, y) {
    if (this.inBounds(x, y)) this.cells[this.idx(x, y)] = 1;
  }

  setObstacle(x, y, resistance = 0.5) {
    if (this.inBounds(x, y)) this.cells[this.idx(x, y)] = resistance;
  }

  setSource(x, y, strength = 1) {
    if (this.inBounds(x, y)) this.sources[this.idx(x, y)] = strength;
  }

  setFlowModifier(x, y, mod) {
    if (this.inBounds(x, y)) this.flowModifier[this.idx(x, y)] = mod;
  }

  isWall(x, y) {
    if (!this.inBounds(x, y)) return true;
    return this.cells[this.idx(x, y)] >= 1;
  }

  isObstacle(x, y) {
    if (!this.inBounds(x, y)) return false;
    const v = this.cells[this.idx(x, y)];
    return v > 0 && v < 1;
  }

  getSpeed(x, y) {
    if (!this.inBounds(x, y)) return 0;
    return this.speed[this.idx(x, y)];
  }

  getVelocity(x, y) {
    if (!this.inBounds(x, y)) return { vx: 0, vy: 0 };
    const i = this.idx(x, y);
    return { vx: this.vx[i], vy: this.vy[i] };
  }

  // Bilinear interpolation of velocity at fractional coordinates
  getVelocityAt(fx, fy) {
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const sx = fx - x0;
    const sy = fy - y0;

    const v00 = this.getVelocity(x0, y0);
    const v10 = this.getVelocity(x1, y0);
    const v01 = this.getVelocity(x0, y1);
    const v11 = this.getVelocity(x1, y1);

    return {
      vx: (1 - sx) * (1 - sy) * v00.vx + sx * (1 - sy) * v10.vx +
          (1 - sx) * sy * v01.vx + sx * sy * v11.vx,
      vy: (1 - sx) * (1 - sy) * v00.vy + sx * (1 - sy) * v10.vy +
          (1 - sx) * sy * v01.vy + sx * sy * v11.vy,
    };
  }

  getMaxSpeed() {
    let max = 0;
    for (let i = 0; i < this.speed.length; i++) {
      if (this.speed[i] > max) max = this.speed[i];
    }
    return max;
  }
}
