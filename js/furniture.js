// Furniture catalog and properties
// Each type has dimensions, flow resistance, and feng shui properties

export const FURNITURE_CATALOG = [
  {
    type: 'sofa',
    label: 'Sofa',
    width: 80,
    height: 35,
    color: '#6b7280',
    flowResistance: 0.7,
    poisonArrow: false,
    flowModifier: 0,
    description: 'Seating area — moderate flow obstruction',
  },
  {
    type: 'bed',
    label: 'Bed',
    width: 60,
    height: 80,
    color: '#7c6f64',
    flowResistance: 0.6,
    poisonArrow: false,
    flowModifier: 0,
    description: 'Rest area — moderate flow obstruction',
  },
  {
    type: 'table',
    label: 'Table',
    width: 50,
    height: 50,
    color: '#8b6f47',
    flowResistance: 0.5,
    poisonArrow: true,
    flowModifier: 0,
    description: 'Sharp corners create poison arrows',
  },
  {
    type: 'desk',
    label: 'Desk',
    width: 60,
    height: 30,
    color: '#7a6240',
    flowResistance: 0.5,
    poisonArrow: true,
    flowModifier: 0,
    description: 'Work surface — sharp corners create poison arrows',
  },
  {
    type: 'chair',
    label: 'Chair',
    width: 20,
    height: 20,
    color: '#9ca3af',
    flowResistance: 0.3,
    poisonArrow: false,
    flowModifier: 0,
    description: 'Small obstruction',
  },
  {
    type: 'bookshelf',
    label: 'Bookshelf',
    width: 40,
    height: 15,
    color: '#92734a',
    flowResistance: 0.8,
    poisonArrow: false,
    flowModifier: 0,
    description: 'Dense storage — high flow obstruction',
  },
  {
    type: 'plant',
    label: 'Plant',
    width: 15,
    height: 15,
    color: '#22c55e',
    flowResistance: 0.1,
    poisonArrow: false,
    flowModifier: 0.2,
    description: 'Enhances chi flow — wood element',
  },
  {
    type: 'mirror',
    label: 'Mirror',
    width: 30,
    height: 5,
    color: '#a5f3fc',
    flowResistance: 0.0,
    poisonArrow: false,
    flowModifier: 0.3,
    description: 'Reflects and redirects chi — water element',
  },
  {
    type: 'rug',
    label: 'Rug',
    width: 60,
    height: 40,
    color: '#b45309',
    flowResistance: 0.05,
    poisonArrow: false,
    flowModifier: 0.1,
    description: 'Grounds energy — earth element',
  },
  {
    type: 'cabinet',
    label: 'Cabinet',
    width: 40,
    height: 20,
    color: '#78716c',
    flowResistance: 0.9,
    poisonArrow: false,
    flowModifier: 0,
    description: 'Heavy storage — high flow obstruction',
  },
];

export function getFurnitureByType(type) {
  return FURNITURE_CATALOG.find(f => f.type === type);
}

// Create a furniture instance for placement
export function createFurnitureInstance(type, x, y) {
  const template = getFurnitureByType(type);
  if (!template) return null;
  return {
    id: Date.now() + Math.random(),
    ...template,
    x,
    y,
    rotation: 0,
  };
}
