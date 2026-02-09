// Bagua map overlay
// Divides the room into a 3x3 grid aligned to the main entrance

const BAGUA_ZONES = [
  // Row 0 (front, near entrance)
  { name: 'Knowledge', color: 'rgba(0, 100, 200, 0.12)', textColor: '#4da6ff', col: 0, row: 0, element: 'Earth' },
  { name: 'Career', color: 'rgba(0, 0, 80, 0.12)', textColor: '#6699ff', col: 1, row: 0, element: 'Water' },
  { name: 'Helpful People', color: 'rgba(180, 180, 180, 0.12)', textColor: '#ccccdd', col: 2, row: 0, element: 'Metal' },
  // Row 1 (middle)
  { name: 'Family', color: 'rgba(0, 150, 0, 0.12)', textColor: '#55cc55', col: 0, row: 1, element: 'Wood' },
  { name: 'Health', color: 'rgba(200, 200, 0, 0.12)', textColor: '#cccc44', col: 1, row: 1, element: 'Earth' },
  { name: 'Children', color: 'rgba(200, 200, 200, 0.12)', textColor: '#ccccdd', col: 2, row: 1, element: 'Metal' },
  // Row 2 (back, far from entrance)
  { name: 'Wealth', color: 'rgba(100, 0, 200, 0.12)', textColor: '#bb77ff', col: 0, row: 2, element: 'Wood' },
  { name: 'Fame', color: 'rgba(200, 0, 0, 0.12)', textColor: '#ff6655', col: 1, row: 2, element: 'Fire' },
  { name: 'Relationships', color: 'rgba(200, 100, 150, 0.12)', textColor: '#ee88aa', col: 2, row: 2, element: 'Earth' },
];

export class BaguaMap {
  constructor() {
    this.zones = BAGUA_ZONES;
  }

  render(ctx, roomBounds, canvasTransform) {
    const { offsetX, offsetY, scaleX, scaleY, roomWidth, roomHeight } = canvasTransform;

    const cellW = roomWidth / 3;
    const cellH = roomHeight / 3;

    ctx.save();
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const zone of this.zones) {
      const x = offsetX + zone.col * cellW * scaleX;
      const y = offsetY + (2 - zone.row) * cellH * scaleY; // flip so "front" is bottom
      const w = cellW * scaleX;
      const h = cellH * scaleY;

      // Fill zone
      ctx.fillStyle = zone.color;
      ctx.fillRect(x, y, w, h);

      // Border
      ctx.strokeStyle = zone.textColor;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);
      ctx.globalAlpha = 1;

      // Label
      ctx.fillStyle = zone.textColor;
      ctx.globalAlpha = 0.7;
      ctx.fillText(zone.name, x + w / 2, y + h / 2 - 8);
      ctx.font = '10px -apple-system, sans-serif';
      ctx.globalAlpha = 0.4;
      ctx.fillText(zone.element, x + w / 2, y + h / 2 + 8);
      ctx.font = '12px -apple-system, sans-serif';
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}
