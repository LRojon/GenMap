/**
 * Utilitaires de couleur et de conversion
 */

export const BIOME_COLORS = {
  0: { name: 'Ocean', rgb: [30, 100, 200] },
  1: { name: 'Beach', rgb: [238, 214, 175] },
  2: { name: 'Plain', rgb: [144, 238, 144] },
  3: { name: 'Forest', rgb: [34, 139, 34] },
  4: { name: 'Grassland', rgb: [210, 180, 140] },
  5: { name: 'Desert', rgb: [255, 215, 0] },
  6: { name: 'Hills', rgb: [128, 128, 64] },
  7: { name: 'Mountain', rgb: [169, 169, 169] },
  8: { name: 'Snow', rgb: [255, 255, 255] },
  9: { name: 'Jungle', rgb: [0, 100, 0] },
  10: { name: 'Swamp', rgb: [144, 200, 160] },
};

export function rgbToString(rgb) {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function interpolateColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function getHeightColor(height) {
  // Convertir la hauteur (0-255) en couleur de terrain
  if (height < 85) return BIOME_COLORS[0].rgb; // Ocean
  if (height < 100) return BIOME_COLORS[1].rgb; // Beach
  if (height < 140) return BIOME_COLORS[2].rgb; // Plain
  if (height < 160) return BIOME_COLORS[4].rgb; // Grassland
  if (height < 180) return BIOME_COLORS[6].rgb; // Hills
  if (height < 210) return BIOME_COLORS[7].rgb; // Mountain
  return BIOME_COLORS[8].rgb; // Snow
}
