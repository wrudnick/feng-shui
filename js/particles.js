// Particle system for chi flow visualization
// Particles spawn at sources (doors/windows) and follow the velocity field
// Speed-proportional movement — fast narrow channels, slow open areas

export class ParticleSystem {
  constructor(grid, maxParticles = 1200) {
    this.grid = grid;
    this.maxParticles = maxParticles;
    this.particles = [];
    this.trailLength = 24;
    this.sourcePositions = [];
  }

  findSources() {
    const g = this.grid;
    this.sourcePositions = [];
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        if (g.sources[g.idx(x, y)] > 0.5) {
          this.sourcePositions.push({ x, y, strength: g.sources[g.idx(x, y)] });
        }
      }
    }
  }

  spawnParticle() {
    if (this.sourcePositions.length === 0) return null;
    const src = this.sourcePositions[Math.floor(Math.random() * this.sourcePositions.length)];
    return {
      x: src.x + (Math.random() - 0.5) * 3,
      y: src.y + (Math.random() - 0.5) * 3,
      trail: [],
      life: 1.0,
      age: 0,
      maxAge: 400 + Math.random() * 600,
      stagnantFrames: 0,
    };
  }

  reset() {
    this.particles = [];
    this.findSources();
  }

  update(dt = 1) {
    const g = this.grid;
    const maxSpeed = g.getMaxSpeed();
    // Normalize movement so particles traverse the room in reasonable time
    // Target: fastest particle moves ~1.5 grid cells per frame
    const moveScale = maxSpeed > 0 ? 1.5 / maxSpeed : 1;

    // Spawn new particles
    while (this.particles.length < this.maxParticles) {
      const p = this.spawnParticle();
      if (!p) break;
      this.particles.push(p);
    }

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Store trail position
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > this.trailLength) {
        p.trail.shift();
      }

      // Get velocity at particle position (bilinear interpolated)
      const gx = Math.floor(p.x);
      const gy = Math.floor(p.y);

      if (!g.inBounds(gx, gy) || g.isWall(gx, gy)) {
        this._respawn(i);
        continue;
      }

      const vel = g.getVelocityAt(p.x, p.y);
      const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);

      // Move particle proportional to actual flow speed
      if (speed > 0.001) {
        p.x += vel.vx * moveScale * dt;
        p.y += vel.vy * moveScale * dt;
        p.stagnantFrames = 0;
      } else {
        // Gentle random drift in stagnant areas
        p.x += (Math.random() - 0.5) * 0.15;
        p.y += (Math.random() - 0.5) * 0.15;
        p.stagnantFrames++;
      }

      // Update life
      p.age += dt;
      p.life = Math.max(0, 1 - p.age / p.maxAge);

      // Die faster if stuck in stagnant zone for too long
      if (p.stagnantFrames > 60) {
        p.life -= 0.02;
      }

      // Remove dead or out-of-bounds particles
      if (p.life <= 0 || p.age > p.maxAge || !g.inBounds(Math.floor(p.x), Math.floor(p.y))) {
        this._respawn(i);
      }
    }
  }

  _respawn(index) {
    const np = this.spawnParticle();
    if (np) this.particles[index] = np;
    else this.particles.splice(index, 1);
  }

  render(ctx, transform) {
    const { offsetX, offsetY, scaleX, scaleY } = transform;
    const g = this.grid;
    const maxSpeed = g.getMaxSpeed();

    for (const p of this.particles) {
      if (p.trail.length < 2) continue;

      const alpha = p.life * 0.8;
      if (alpha <= 0.01) continue;

      // Get speed at particle for coloring
      const gx = Math.floor(p.x);
      const gy = Math.floor(p.y);
      const speed = g.inBounds(gx, gy) ? g.getSpeed(gx, gy) : 0;
      const speedRatio = maxSpeed > 0 ? speed / maxSpeed : 0;

      // Color: gentle flow = cyan/green (good chi), fast flow = orange/red (sha chi)
      let hue, sat, light;
      if (speedRatio > 0.7) {
        // Fast flow — sha chi (harmful rushing energy)
        hue = 15 + (1 - speedRatio) * 30; // orange to red
        sat = 85;
        light = 55;
      } else if (speedRatio > 0.3) {
        // Medium flow — good chi
        hue = 165 + speedRatio * 30; // cyan-green
        sat = 75;
        light = 50 + speedRatio * 15;
      } else {
        // Slow/stagnant — dim
        hue = 200;
        sat = 50;
        light = 35 + speedRatio * 20;
      }

      // Draw trail with gradient fade
      ctx.beginPath();
      const t0 = p.trail[0];
      ctx.moveTo(offsetX + t0.x * scaleX, offsetY + t0.y * scaleY);

      for (let j = 1; j < p.trail.length; j++) {
        const t = p.trail[j];
        ctx.lineTo(offsetX + t.x * scaleX, offsetY + t.y * scaleY);
      }
      ctx.lineTo(offsetX + p.x * scaleX, offsetY + p.y * scaleY);

      // Trail thickness varies with speed
      const trailWidth = 1 + speedRatio * 1.5;
      ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha * 0.5})`;
      ctx.lineWidth = trailWidth;
      ctx.stroke();

      // Draw particle head — larger when moving fast
      const headSize = 1.5 + speedRatio * 2;
      ctx.beginPath();
      ctx.arc(offsetX + p.x * scaleX, offsetY + p.y * scaleY, headSize, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light + 15}%, ${alpha})`;
      ctx.fill();
    }
  }
}
