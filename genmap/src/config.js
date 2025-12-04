/**
 * Configuration globale de l'application GenMap
 */

export const CONFIG = {
  // Paramètres de la carte
  MAP: {
    DEFAULT_WIDTH: 1024,
    DEFAULT_HEIGHT: 768,
    MIN_WIDTH: 512,
    MAX_WIDTH: 2048,
    MIN_HEIGHT: 384,
    MAX_HEIGHT: 1536,
    DEFAULT_SEED: 0,
  },

  // Paramètres de génération Perlin
  PERLIN: {
    SCALE: 50,
    OCTAVES: 8,
    PERSISTENCE: 0.5,
    LACUNARITY: 2.0,
  },

  // Seuils d'altitude pour les biomes
  ALTITUDE_THRESHOLDS: {
    WATER: 85,
    BEACH: 100,
    PLAIN: 140,
    GRASSLAND: 160,
    HILLS: 180,
    MOUNTAIN: 210,
    SNOW: 255,
  },

  // Palette de couleurs (RGB)
  COLORS: {
    OCEAN: [30, 100, 200],
    BEACH: [238, 214, 175],
    PLAIN: [144, 238, 144],
    FOREST: [34, 139, 34],
    GRASSLAND: [210, 180, 140],
    DESERT: [255, 215, 0],
    HILLS: [128, 128, 64],
    MOUNTAIN: [169, 169, 169],
    SNOW: [255, 255, 255],
    JUNGLE: [0, 100, 0],
    SWAMP: [144, 200, 160],

    // Couleurs UI
    PRIMARY_GRADIENT: ['#667eea', '#764ba2'],
    GLASS_BG: 'rgba(255, 255, 255, 0.1)',
    GLASS_BORDER: 'rgba(255, 255, 255, 0.2)',
  },

  // Voronoi
  VORONOI: {
    POINTS_PER_AREA: 15000, // 1 point tous les 15000 pixels
  },

  // UI
  UI: {
    PANEL_WIDTH: 340,
    BORDER_RADIUS: 20,
    BLUR_AMOUNT: 10,
  },
};

export default CONFIG;
