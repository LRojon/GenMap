/**
 * Classe Map - Génération principale de la carte
 * Convertie depuis map.py du projet Python
 */

import { SeededRandom } from './seededRandom';
import { generatePerlinNoise } from './perlin';
import { generateVoronoi } from './voronoi';
import { ProcNameGenerator } from './procNameGenerator';
import { getNextSeed } from './seedGenerator';

export const SEA_LEVEL = 127;

export class Map {
  constructor(width, height, seed = 0) {
    this.width = width;
    this.height = height;
    this.seed = seed || Math.floor(Math.random() * (2 ** 32));
    this.rng = new SeededRandom(this.seed);

    // Données de la carte
    this.heightMap = null;
    this.biomes = null;
    this.climate = null;
    this.religions = null;
    this.cultures = null;
    this.regions = null;

    // Métadonnées
    this.cities = [];
    this.countries = [];
    this.rivers = [];
    this.routes = [];
    this.regionEdges = [];

    // Noms procéduraux
    this.religionNames = new Map();
    this.cultureNames = new Map();
  }

  /**
   * Génère la carte complète
   */
  generate() {
    console.log(`Generating map ${this.width}x${this.height} with seed ${this.seed}`);

    try {
      // 1. Générer la carte de hauteur avec Perlin Noise
      console.log('Step 1: Generating height map...');
      // Limiter la taille de la carte pour éviter les problèmes de performance
      const maxDimension = 2000;
      if (this.width > maxDimension || this.height > maxDimension) {
        throw new Error(`Map dimensions too large: ${this.width}x${this.height}. Max: ${maxDimension}x${maxDimension}`);
      }
      
      this.heightMap = generatePerlinNoise(this.width, this.height, this.seed, 4); // Réduire octaves de 8 à 4

      // 2. Générer les biomes basés sur la hauteur
      console.log('Step 2: Generating biomes...');
      this.generateBiomes();

      // 3. Générer le climat
      console.log('Step 3: Generating climate...');
      this.generateClimate();

      // 4. Générer les rivières
      console.log('Step 4: Generating rivers...');
      this.generateRivers();

      // 5. Générer les régions Voronoi
      console.log('Step 5: Generating regions...');
      this.generateRegions();

      // 6. Générer les villes
      console.log('Step 6: Generating cities...');
      this.generateCities();

      // 7. Générer les routes
      console.log('Step 7: Generating routes...');
      this.generateRoutes();

      // 8. Générer les religions et cultures
      console.log('Step 8: Generating religions and cultures...');
      this.generateReligionsAndCultures();

      console.log('Map generation complete!');
    } catch (error) {
      console.error('Error generating map:', error);
      throw error;
    }

    return this;
  }

  /**
   * Génère les biomes basés sur la hauteur et l'humidité
   */
  generateBiomes() {
    this.biomes = new Uint8Array(this.width * this.height);

    for (let i = 0; i < this.width * this.height; i++) {
      const height = this.heightMap[i];
      let biome = 0;

      if (height < 85) {
        biome = 0; // Eau
      } else if (height < 100) {
        biome = 1; // Plage
      } else if (height < 140) {
        biome = 2; // Plaine
      } else if (height < 160) {
        biome = 4; // Prairie
      } else if (height < 180) {
        biome = 6; // Collines
      } else if (height < 210) {
        biome = 7; // Montagne
      } else {
        biome = 8; // Neige
      }

      this.biomes[i] = biome;
    }
  }

  /**
   * Génère la carte de climat basée sur la latitude et altitude
   */
  generateClimate() {
    this.climate = new Uint8Array(this.width * this.height);

    for (let i = 0; i < this.width * this.height; i++) {
      const x = i % this.width;
      const y = Math.floor(i / this.width);
      const height = this.heightMap[i];

      // Latitude influence (0 = équateur, 255 = pôles)
      const latitude = Math.abs(y - this.height / 2) / (this.height / 2);
      const climateFromLatitude = Math.floor(latitude * 255);

      // Altitude influence
      const climateFromAltitude = Math.floor((height / 255) * 100);

      // Combiner les deux
      let climate = Math.max(climateFromLatitude, climateFromAltitude);
      climate = Math.min(255, Math.max(0, climate));

      this.climate[i] = climate;
    }
  }

  /**
   * Génère les rivières basées sur la hauteur
   */
  generateRivers() {
    this.rivers = [];
    const riverMap = new Uint8Array(this.width * this.height);

    // Trouver les minima locaux (sources de rivières)
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const idx = y * this.width + x;
        const current = this.heightMap[idx];

        // Vérifier si c'est un minimum local
        let isMinimum = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = (y + dy) * this.width + (x + dx);
            if (this.heightMap[nIdx] < current) {
              isMinimum = false;
              break;
            }
          }
          if (!isMinimum) break;
        }

        // Si c'est un minimum et pas dans l'eau, commence une rivière
        if (isMinimum && current > SEA_LEVEL && current < 180) {
          this.rivers.push({ x, y, height: current });
        }
      }
    }
  }

  /**
   * Génère les régions Voronoi
   */
  generateRegions() {
    // Utiliser les centres de Voronoi basés sur les hauteurs
    const points = [];

    // Ajouter des points aléatoires
    const nbRand = Math.max(20, Math.floor((this.width * this.height) / 1300));
    for (let i = 0; i < nbRand; i++) {
      const x = this.rng.randint(0, this.width);
      const y = this.rng.randint(0, this.height);
      points.push([x, y]);
    }

    // Générer les régions Voronoi
    const voronoi = generateVoronoi(points, this.width, this.height);
    this.regions = voronoi;
  }

  /**
   * Génère les villes
   */
  generateCities() {
    this.cities = [];
    const cityCount = this.rng.randint(5, 20);

    for (let i = 0; i < cityCount; i++) {
      // Chercher une position valide pour la ville
      let attempts = 0;
      let x, y, valid = false;

      while (!valid && attempts < 100) {
        x = this.rng.randint(0, this.width);
        y = this.rng.randint(0, this.height);

        const idx = y * this.width + x;
        const height = this.heightMap[idx];
        const biome = this.biomes[idx];

        // La ville doit être sur un terrain non-aquatique, non-neige
        valid = height > SEA_LEVEL && height < 210;
        attempts++;
      }

      if (valid) {
        const cityName = ProcNameGenerator.generateCityName(getNextSeed(this.seed, i + 1), i);
        this.cities.push({
          id: i,
          name: cityName,
          x,
          y,
          population: this.rng.randint(1000, 50000),
        });
      }
    }
  }

  /**
   * Génère les routes entre les villes
   */
  generateRoutes() {
    this.routes = [];

    if (this.cities.length < 2) return;

    // Connecter les villes avec des routes simples
    for (let i = 0; i < this.cities.length; i++) {
      for (let j = i + 1; j < this.cities.length; j++) {
        const city1 = this.cities[i];
        const city2 = this.cities[j];

        // Tracer une ligne entre les deux villes
        const route = this.bresenhamLine(city1.x, city1.y, city2.x, city2.y);
        this.routes.push({
          from: city1.id,
          to: city2.id,
          path: route,
        });
      }
    }
  }

  /**
   * Algorithme de Bresenham pour tracer une ligne
   */
  bresenhamLine(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      points.push([x, y]);

      if (x === x1 && y === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }

    return points;
  }

  /**
   * Génère les religions et cultures pour les régions
   */
  generateReligionsAndCultures() {
    this.religions = new Uint32Array(this.width * this.height);
    this.cultures = new Uint32Array(this.width * this.height);

    // Assigner des religions et cultures à chaque région
    const numReligions = this.rng.randint(3, 8);
    const numCultures = this.rng.randint(3, 8);

    for (let i = 0; i < numReligions; i++) {
      const religionName = ProcNameGenerator.generateReligionName(getNextSeed(this.seed, i + 1));
      this.religionNames.set(i, religionName);
    }

    for (let i = 0; i < numCultures; i++) {
      const cultureName = ProcNameGenerator.generateCultureName(getNextSeed(this.seed, numReligions + i + 1));
      this.cultureNames.set(i, cultureName);
    }

    // Assigner aléatoirement aux pixels
    for (let i = 0; i < this.width * this.height; i++) {
      this.religions[i] = this.rng.randint(0, numReligions);
      this.cultures[i] = this.rng.randint(0, numCultures);
    }
  }

  /**
   * Exporte les données pour visualisation
   */
  toJSON() {
    return {
      width: this.width,
      height: this.height,
      seed: this.seed,
      heightMap: Array.from(this.heightMap),
      biomes: Array.from(this.biomes),
      climate: Array.from(this.climate),
      cities: this.cities,
      rivers: this.rivers,
      routes: this.routes,
      religionNames: Array.from(this.religionNames.entries()),
      cultureNames: Array.from(this.cultureNames.entries()),
    };
  }
}
