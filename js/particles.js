// Particle system for chi flow visualization
// Particles spawn at sources (doors/windows) and follow the velocity field

export class ParticleSystem {
  constructor(grid, maxParticles = 800) {
    this.grid = grid;
    this.maxParticles = maxParticles;
    this.particles = [];
    this.trailLength = 12;
    this.sourcePositions = []; // grid coords where particles spawn
  }

  findSources() {
    const g = this.grid;
    this.sourcePositions = [];
    for (let y = 0; y < g.height; y++) {
      for (let x = 0; x < g.width; x++) {
        if (g.sources[g.idx(x, y)] > 0.5) {
          this.sourcePositions.push({ x, y });
        }
      }
    }
  }

  spawnParticle() {
    if (this.sourcePositions.length === 0) return null;
    const src = this.sourcePositions[Math.floor(Math.random() * this.sourcePositions.length)];
    return {
      x: src.x + (Math.random() - 0.5) * 2,
      y: src.y + (Math.random() - 0.5) * 2,
      trail: [],
      life: 1.0,
      age: 0,
      maxAge: 200 + Math.random() * 300,
    };
  }

  reset() {
    this.particles = [];
    this.findSources();
  }

  update(dt = 1) {
    const g = this.grid;

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

      // Get velocity at particle position
      const gx = Math.floor(p.x);
      const gy = Math.floor(p.y);

      if (!g.inBounds(gx, gy) || g.isWall(gx, gy)) {
        // Dead particle — respawn
        const np = this.spawnParticle();
        if (np) this.particles[i] = np;
        else this.particles.splice(i, 1);
        continue;
      }

      const vel = g.getVelocityAt(p.x, p.y);
      const speed = Math.sqrt(vel.vx * vel.vx + vel.vy * vel.vy);

      // Move particle
      const moveScale = 0.5;
      if (speed > 0.01) {
        p.x += vel.vx * moveScale * dt / Math.max(speed, 1);
        p.y += vel.vy * moveScale * dt / Math.max(speed, 1);
      } else {
        // Add slight random drift in stagnant areas
        p.x += (Math.random() - 0.5) * 0.3;
        p.y += (Math.random() - 0.5) * 0.3;
      }

      // Update life based on speed
      p.age += dt;
      p.life = Math.max(0, 1 - p.age / p.maxAge);

      // Fade faster in stagnant zones
      if (speed < 0.1) {
        p.life -= 0.005;
      }

      // Remove dead particles
      if (p.life <= 0 || p.age > p.maxAge || !g.inBounds(Math.floor(p.x), Math.floor(p.y))) {
        const np = this.spawnParticle();
        if (np) this.particles[i] = np;
        else this.particles.splice(i, 1);
      }
    }
  }

  render(ctx, transform) {
    // transform: { offsetX, offsetY, scale } — maps grid coords to canvas coords
    const { offsetX, offsetY, scaleX, scaleY } = transform;

    for (const p of this.particles) {
      if (p.trail.length < 2) continue;

      const alpha = p.life * 0.7;
      if (alpha <= 0) continue;

      // Get speed at particle for coloring
      const gx = Math.floor(p.x);
      const gy = Math.floor(p.y);
      const speed = this.grid.inBounds(gx, gy) ? this.grid.getSpeed(gx, gy) : 0;

      // Color: cyan for good flow, dimmer for slow
      const hue = 185;
      const sat = 80;
      const light = 40 + Math.min(speed * 20, 40);

      // Draw trail
      ctx.beginPath();
      const t0 = p.trail[0];
      ctx.moveTo(offsetX + t0.x * scaleX, offsetY + t0.y * scaleY);

      for (let j = 1; j < p.trail.length; j++) {
        const t = p.trail[j];
        ctx.lineTo(offsetX + t.x * scaleX, offsetY + t.y * scaleY);
      }
      // Line to current position
      ctx.lineTo(offsetX + p.x * scaleX, offsetY + p.y * scaleY);

      ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw particle head
      ctx.beginPath();
      ctx.arc(offsetX + p.x * scaleX, offsetY + p.y * scaleY, 2, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light + 20}%, ${alpha})`;
      ctx.fill();
    }
  }
}
