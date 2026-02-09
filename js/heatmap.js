// Heatmap overlay rendering from flow simulation data

export class Heatmap {
  constructor(grid) {
    this.grid = grid;
    this.imageData = null;
    this.canvas = null;
    this.dirty = true;
  }

  // Pre-render heatmap to offscreen canvas
  generate() {
    const g = this.grid;
    this.canvas = document.createElement('canvas');
    this.canvas.width = g.width;
    this.canvas.height = g.height;
    const ctx = this.canvas.getContext('2d');
    this.imageData = ctx.createImageData(g.width, g.height);
    const data = this.imageData.data;

    const maxSpeed = g.getMaxSpeed();
    if (maxSpeed === 0) return;

    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        const i = g.idx(x, y);
        const pi = (y * g.width + x) * 4;

        if (g.cells[i] >= 1) {
          // Walls: dark
          data[pi] = 30;
          data[pi + 1] = 30;
          data[pi + 2] = 50;
          data[pi + 3] = 200;
          continue;
        }

        const speed = g.speed[i];
        const normalized = Math.min(speed / maxSpeed, 1);

        // Color map: red (stagnant) → yellow (moderate) → cyan/blue (good flow)
        let r, gr, b;
        if (normalized < 0.15) {
          // Stagnant: red
          const t = normalized / 0.15;
          r = 200 + 55 * (1 - t);
          gr = 50 * t;
          b = 30;
        } else if (normalized < 0.4) {
          // Moderate: yellow/orange
          const t = (normalized - 0.15) / 0.25;
          r = 220 - 80 * t;
          gr = 50 + 150 * t;
          b = 30 + 20 * t;
        } else {
          // Good flow: green to cyan
          const t = (normalized - 0.4) / 0.6;
          r = 40 - 20 * t;
          gr = 200 - 40 * t;
          b = 50 + 180 * t;
        }

        const alpha = 120 + 60 * (1 - normalized);

        data[pi] = r;
        data[pi + 1] = gr;
        data[pi + 2] = b;
        data[pi + 3] = g.cells[i] > 0 ? alpha * 0.5 : alpha;
      }
    }

    ctx.putImageData(this.imageData, 0, 0);
    this.dirty = false;
  }

  render(ctx, transform) {
    if (!this.canvas) return;
    const { offsetX, offsetY, scaleX, scaleY } = transform;
    ctx.globalAlpha = 0.5;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.canvas,
      offsetX, offsetY,
      this.grid.width * scaleX,
      this.grid.height * scaleY
    );
    ctx.globalAlpha = 1;
  }
}
