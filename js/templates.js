// Pre-built room templates
// Coordinates are in "world" units (roughly 1 unit = 1 pixel at default zoom)

export const TEMPLATES = {
  studio: {
    name: 'Studio Apartment',
    walls: [
      { x1: 50, y1: 50, x2: 400, y2: 50 },
      { x1: 400, y1: 50, x2: 400, y2: 350 },
      { x1: 400, y1: 350, x2: 50, y2: 350 },
      { x1: 50, y1: 350, x2: 50, y2: 50 },
      // Bathroom partition
      { x1: 320, y1: 50, x2: 320, y2: 180 },
      { x1: 320, y1: 180, x2: 400, y2: 180 },
    ],
    doors: [
      { x1: 50, y1: 180, x2: 50, y2: 220 }, // Main entrance (left wall)
      { x1: 320, y1: 90, x2: 320, y2: 130 }, // Bathroom door
    ],
    windows: [
      { x1: 150, y1: 50, x2: 250, y2: 50 }, // Top wall window
      { x1: 400, y1: 250, x2: 400, y2: 320 }, // Right wall window
    ],
    furniture: [],
  },

  living: {
    name: 'Living Room',
    walls: [
      { x1: 50, y1: 50, x2: 450, y2: 50 },
      { x1: 450, y1: 50, x2: 450, y2: 350 },
      { x1: 450, y1: 350, x2: 50, y2: 350 },
      { x1: 50, y1: 350, x2: 50, y2: 50 },
    ],
    doors: [
      { x1: 50, y1: 150, x2: 50, y2: 200 },
    ],
    windows: [
      { x1: 150, y1: 50, x2: 250, y2: 50 },
      { x1: 300, y1: 50, x2: 400, y2: 50 },
      { x1: 450, y1: 200, x2: 450, y2: 300 },
    ],
    furniture: [],
  },

  bedroom: {
    name: 'Bedroom',
    walls: [
      { x1: 80, y1: 80, x2: 380, y2: 80 },
      { x1: 380, y1: 80, x2: 380, y2: 330 },
      { x1: 380, y1: 330, x2: 80, y2: 330 },
      { x1: 80, y1: 330, x2: 80, y2: 80 },
    ],
    doors: [
      { x1: 80, y1: 250, x2: 80, y2: 290 },
    ],
    windows: [
      { x1: 180, y1: 80, x2: 280, y2: 80 },
    ],
    furniture: [],
  },

  lshaped: {
    name: 'L-Shaped Room',
    walls: [
      { x1: 50, y1: 50, x2: 350, y2: 50 },
      { x1: 350, y1: 50, x2: 350, y2: 200 },
      { x1: 350, y1: 200, x2: 250, y2: 200 },
      { x1: 250, y1: 200, x2: 250, y2: 380 },
      { x1: 250, y1: 380, x2: 50, y2: 380 },
      { x1: 50, y1: 380, x2: 50, y2: 50 },
    ],
    doors: [
      { x1: 50, y1: 150, x2: 50, y2: 200 },
    ],
    windows: [
      { x1: 150, y1: 50, x2: 260, y2: 50 },
      { x1: 250, y1: 280, x2: 250, y2: 360 },
    ],
    furniture: [],
  },

  openplan: {
    name: 'Open Plan Kitchen/Living',
    walls: [
      { x1: 30, y1: 30, x2: 500, y2: 30 },
      { x1: 500, y1: 30, x2: 500, y2: 380 },
      { x1: 500, y1: 380, x2: 30, y2: 380 },
      { x1: 30, y1: 380, x2: 30, y2: 30 },
      // Kitchen island / counter
      { x1: 280, y1: 30, x2: 280, y2: 160 },
    ],
    doors: [
      { x1: 30, y1: 180, x2: 30, y2: 230 },
      { x1: 500, y1: 300, x2: 500, y2: 350 }, // Back door
    ],
    windows: [
      { x1: 100, y1: 30, x2: 220, y2: 30 },
      { x1: 340, y1: 30, x2: 460, y2: 30 },
      { x1: 500, y1: 80, x2: 500, y2: 180 },
    ],
    furniture: [],
  },
};

export function getTemplate(name) {
  return TEMPLATES[name] || null;
}

export function getTemplateList() {
  return Object.entries(TEMPLATES).map(([key, t]) => ({
    key,
    name: t.name,
  }));
}
