import { generatePerlinNoise } from './perlin';
import { getNextSeed } from './seedGenerator';
import { CityPlacer } from './cities';
import { CountryGenerator } from './countries';
import { RouteGenerator } from './routes';
import { ReligionSystem } from './religionSystem';
import { SEA_LEVEL } from './constants';

export class Map {
  constructor() {
    this.heightMap = null;
    this.climateMap = null;
    this.biomeMap = null;
    this.riverMap = null;
    this.cities = null;
    this.countries = null;
    this.routes = null;
    // Cache pour les conversions 1D
    this._heightMap1D = null;
    this._climateMap1D = null;
    this._biomeMap1D = null;
  }

  // Nettoyer les caches lors de la génération d'une nouvelle carte
  _clearCache() {
    this._heightMap1D = null;
    this._climateMap1D = null;
    this._biomeMap1D = null;
  }

  generate(width, height, seed, maskStrength = 1.5) {
    // Nettoyer les caches avant nouvelle génération
    this._clearCache();
    
    // Stocker width et height pour accès ultérieur (p.ex. dans ReligionSystem)
    this.width = width;
    this.height = height;
    
    // Nettoyer la console
    console.clear();
    
    // Log du démarrage
    console.log('%c=== GenMap Generation Started ===', 'color: #667eea; font-weight: bold; font-size: 14px;');
    
    const globalStartTime = performance.now();
    let stepStartTime;

    // Étape 1: Height Map
    stepStartTime = performance.now();
    this.genHeightMap(width, height, seed);
    let stepTime = performance.now() - stepStartTime;
    console.log(`%c⏱ Height Map: ${stepTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Étape 2: Variation
    stepStartTime = performance.now();
    this.genVariation(width, height, getNextSeed(seed, 1), maskStrength);
    stepTime = performance.now() - stepStartTime;
    console.log(`%c⏱ Variation (Island Mask): ${stepTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Étape 3: Climate
    stepStartTime = performance.now();
    this.genClimate(width, height, getNextSeed(seed, 2));
    stepTime = performance.now() - stepStartTime;
    console.log(`%c⏱ Climate: ${stepTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Étape 4: Biomes
    stepStartTime = performance.now();
    this.genBiomes(width, height);
    stepTime = performance.now() - stepStartTime;
    console.log(`%c⏱ Biomes: ${stepTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Étape 5: Rivers
    stepStartTime = performance.now();
    this.genRivers(width, height, getNextSeed(seed, 3));
    stepTime = performance.now() - stepStartTime;
    console.log(`%c⏱ Rivers: ${stepTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Étape 6: Cities
    stepStartTime = performance.now();
    this.genCities(width, height, getNextSeed(seed, 4));
    stepTime = performance.now() - stepStartTime;
    console.log(`%c⏱ Cities: ${stepTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Étape 7: Countries
    stepStartTime = performance.now();
    this.genCountries(width, height, getNextSeed(seed, 5));
    stepTime = performance.now() - stepStartTime;
    console.log(`%c⏱ Countries: ${stepTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Étape 8: Routes
    stepStartTime = performance.now();
    this.genRoutes(width, height, getNextSeed(seed, 6));
    stepTime = performance.now() - stepStartTime;
    console.log(`%c⏱ Routes: ${stepTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Étape 9: Religions
    stepStartTime = performance.now();
    this.genReligions(getNextSeed(seed, 7));
    stepTime = performance.now() - stepStartTime;
    console.log(`%c⏱ Religions & Cultures: ${stepTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Temps total
    const globalTime = performance.now() - globalStartTime;
    const globalTimeSeconds = (globalTime / 1000).toFixed(3);
    console.log(`%c✓ Total Generation Time: ${globalTime.toFixed(2)}ms (${globalTimeSeconds}s)`, 'color: #667eea; font-weight: bold; font-size: 14px;');
    console.log('%c=== Generation Complete ===', 'color: #667eea; font-weight: bold; font-size: 14px;');
  }

  genHeightMap(width, height, seed) {
    
    const perlinNoise = generatePerlinNoise(width, height, seed, 8, 0.5, 100);
    
    this.heightMap = new Array(height);
    for (let y = 0; y < height; y++) {
      this.heightMap[y] = new Array(width);
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        this.heightMap[y][x] = perlinNoise[idx];
      }
    }
    return this.heightMap;
  }

  genVariation(width, height, seed, maskStrength = 3) { 
    if (!this.heightMap) {
      throw new Error('heightMap must be generated first with genHeightMap()');
    }
    const variationNoise = generatePerlinNoise(width, height, seed, 8, 0.5, 500);
    
    // Centre de la carte
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        const noiseNormalized = variationNoise[idx] / 255;
        const factor = 0.5 + (noiseNormalized * 1.0);
        
        let newValue = this.heightMap[y][x] * factor * 1.3;
        
        // Appliquer le mask radial pour créer l'apparance d'îles
        // Distance du centre
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Falloff graduel vers les bords (force ajustable)
        const falloff = 1 - Math.pow(dist / maxDist, maskStrength);
        
        // Appliquer le falloff à la hauteur
        newValue *= falloff;
        
        
        newValue = Math.max(0, Math.min(255, newValue));
        this.heightMap[y][x] = Math.floor(newValue);
      }
    }
    
    return this.heightMap;
  }


  getHeightMap1D() {
    if (!this.heightMap) {
      return null;
    }

    // Retourner du cache si disponible
    if (this._heightMap1D) {
      return this._heightMap1D;
    }

    const width = this.heightMap[0].length;
    const height = this.heightMap.length;
    const result = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[y * width + x] = this.heightMap[y][x];
      }
    }

    // Stocker en cache
    this._heightMap1D = result;
    return result;
  }

  genClimate(width, height, seed) {
    
    const climateNoise = generatePerlinNoise(width, height, seed, 6, 0.6, 125);
    
    // Utiliser une fonction pseudo-aléatoire déterministe basée sur la seed
    const pseudoRandom = ((seed ^ 0x9E3779B1) * 2654435761) >>> 0;
    const normalized = (pseudoRandom % 1000) / 1000; // Valeur entre 0 et 1
    const globalTemperatureShift = (normalized - 0.5) * 50; // Valeur entre -25 et +25

    this.climateMap = new Array(height);
    for (let y = 0; y < height; y++) {
      this.climateMap[y] = new Array(width);
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        this.climateMap[y][x] = Math.floor(climateNoise[idx] + globalTemperatureShift);
        this.climateMap[y][x] = Math.max(0, Math.min(255, this.climateMap[y][x]));
      }
    }
    
    return this.climateMap;
  }

  getClimateMap1D() {
    if (!this.climateMap) {
      return null;
    }

    // Retourner du cache si disponible
    if (this._climateMap1D) {
      return this._climateMap1D;
    }

    const width = this.climateMap[0].length;
    const height = this.climateMap.length;
    const result = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[y * width + x] = this.climateMap[y][x];
      }
    }

    // Stocker en cache
    this._climateMap1D = result;
    return result;
  }

  genBiomes(width, height) {
    if (!this.heightMap || !this.climateMap) {
      throw new Error('heightMap and climateMap must be generated first');
    }

    this.biomeMap = new Array(height);

    for (let y = 0; y < height; y++) {
      this.biomeMap[y] = new Array(width);
      for (let x = 0; x < width; x++) {
        const altitude = this.heightMap[y][x];
        const climate = this.climateMap[y][x];

        let biome;

        // Eau
        if (altitude <= SEA_LEVEL) {
          biome = 0;
        }
        // Plage/Côte
        else if (altitude <= 135) {
          biome = 1;
        }
        // Climat tropical (170-255) -> Jungle
        else if (altitude >= 135 && altitude <= 180 && climate >= 170) {
          biome = 9;
        }
        // Climat très humide + altitude basse -> Marécage
        else if (altitude >= 120 && altitude <= 140 && climate >= 120 && climate <= 170) {
          biome = 10;
        }
        // Altitude basse-moyenne (135-160)
        else if (altitude >= 135 && altitude <= 160) {
          if (climate >= 200) {
            // Désertique
            biome = 5;
          } else if (climate >= 160) {
            // Tropical/Humide -> Forêt
            biome = 3;
          } else if (climate >= 85) {
            // Tempéré
            biome = climate >= 120 ? 3 : 2; // Forêt tempérée ou Plaine
          } else {
            // Polaire -> Toundra
            biome = 11;
          }
        }
        // Altitude moyenne (160-180) -> Collines
        else if (altitude >= 160 && altitude <= 180) {
          biome = climate >= 200 ? 5 : 6; // Désert montagneux ou Collines
        }
        // Altitude haute (180-200) -> Montagne
        else if (altitude >= 180 && altitude <= 200) {
          biome = 7;
        }
        // Altitude très haute (200+) -> Pics/Neige
        else {
          biome = 8;
        }

        this.biomeMap[y][x] = biome;
      }
    }

    return this.biomeMap;
  }

  getBiomeMap1D() {
    if (!this.biomeMap) {
      return null;
    }

    // Retourner du cache si disponible
    if (this._biomeMap1D) {
      return this._biomeMap1D;
    }

    const width = this.biomeMap[0].length;
    const height = this.biomeMap.length;
    const result = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        result[y * width + x] = this.biomeMap[y][x];
      }
    }

    // Stocker en cache
    this._biomeMap1D = result;
    return result;
  }

  genRivers(width, height, seed) {
    /**
     * Génère les rivières en trouvant les points hauts et en suivant le gradient descendant
     * Algorithme: Gradient Descent vers l'altitude minimale
     */
    this.rivers = [];
    this.riverMap = new Uint8Array(width * height); // Marker pour les pixels rivière
    
    // Nombre de rivières = fonction de la taille de la carte
    const riverCount = 1 + Math.floor((width + height) / 200);
    
    // Trouver les points hauts potentiels (altitude >= 200)
    const highPoints = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const altitude = this.heightMap[y][x];
        if (altitude >= 200) {
          highPoints.push({ x, y, altitude });
        }
      }
    }
    
    // Générer les rivières depuis les points hauts
    for (let i = 0; i < riverCount && highPoints.length > 0; i++) {
      const startIndex = Math.floor((seed + i * 37) % highPoints.length);
      const start = highPoints[startIndex];
      
      // Passer une seed déterministe à traceRiver
      const riverSeed = getNextSeed(seed, i + 1);
      const river = this.traceRiver(start, width, height, riverSeed);
      if (river && river.length > 5) {
        this.rivers.push(river);
        this.applyRiverToHeightMap(river, width, height);
      }
    }
  }

  traceRiver(start, width, height, seed) {
    /**
     * Trace une rivière en suivant le gradient descendant
     * Utilise le gradient descent: toujours aller vers le voisin le plus bas
     * Avec 15% de chance de prendre un chemin aléatoire (pour l'organicité)
     * Utilise une seed déterministe pour la reproductibilité
     */
    const river = [start];
    const visited = new Set([`${start.x},${start.y}`]);
    let current = start;
    const MAX_ITERATIONS = (width + height) * 5;
    let iterations = 0;
    let pseudoRandom = seed; // Seed pseudo-aléatoire
    
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const { x, y } = current;
      
      // Arrêter si la rivière atteint la mer
      if (this.heightMap[y][x] <= SEA_LEVEL) {
        return river;
      }
      
      // Trouver tous les voisins (8 directions)
      const neighbors = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const key = `${nx},${ny}`;
            if (!visited.has(key)) {
              const altitude = this.heightMap[ny][nx];
              neighbors.push({ x: nx, y: ny, altitude });
            }
          }
        }
      }
      
      if (neighbors.length === 0) break; // Cul-de-sac
      
      // Trier par altitude (descendant)
      neighbors.sort((a, b) => a.altitude - b.altitude);
      
      // 85% du temps: prendre le chemin le plus bas
      // 15% du temps: prendre un chemin aléatoire (plus haut) pour l'organicité
      let next;
      
      // Générer un nombre pseudo-aléatoire déterministe
      pseudoRandom = ((pseudoRandom ^ 0x9E3779B1) * 2654435761) >>> 0;
      const randomValue = (pseudoRandom % 1000) / 1000; // 0-1
      
      if (randomValue < 0.85) {
        next = neighbors[0];
      } else {
        // Choisir parmi les 2 premiers voisins
        next = neighbors[Math.min(1, neighbors.length - 1)];
      }
      
      current = { x: next.x, y: next.y };
      visited.add(`${next.x},${next.y}`);
      river.push(current);
    }
    
    return river;
  }

  applyRiverToHeightMap(river, width, height) {
    /**
     * Applique l'érosion de la rivière à la heightMap
     * Réduit l'altitude le long du chemin de la rivière
     */
    const RIVER_WIDTH = 0;
    
    for (const point of river) {
      const { x, y } = point;
      
      // Appliquer l'érosion en cercle autour du point
      for (let dy = -RIVER_WIDTH; dy <= RIVER_WIDTH; dy++) {
        for (let dx = -RIVER_WIDTH; dx <= RIVER_WIDTH; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          
          // Vérifier les limites
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          
          // Vérifier la distance (cercle)
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist > RIVER_WIDTH) continue;
          
          // Réduire l'altitude
          const erosion = dist === 0 ? 3 : (dist === 1 ? 2 : 1);
          this.heightMap[ny][nx] = Math.max(SEA_LEVEL + 1, this.heightMap[ny][nx] - erosion);
          
          // Marquer comme rivière
          this.riverMap[ny * width + nx] = 1;
        }
      }
    }
  }

  getRiverMap1D() {
    if (!this.riverMap) {
      return null;
    }
    return this.riverMap;
  }

  genCities(width, height, seed) {
    // Nombre de villes basé sur la superficie
    // Superficie / 10000 avec variation organique de ±20%
    const baseNumCities = Math.floor((width * height) / 10000);
    
    // Variation aléatoire déterministe: ±20%
    let rngState = seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };
    
    const variation = 0.8 + seededRandom() * 0.4; // Entre 0.8 et 1.2 (±20%)
    const numCities = Math.max(2, Math.floor(baseNumCities * variation));

    // Convertir les maps 2D en 1D
    const heightMap1D = this.getHeightMap1D();
    const climateMap1D = this.getClimateMap1D();
    const biomeMap1D = this.getBiomeMap1D();
    const riverMap1D = this.getRiverMap1D();

    // Créer le placer de villes
    const cityPlacer = new CityPlacer(
      heightMap1D, 
      climateMap1D, 
      biomeMap1D, 
      riverMap1D,
      width, 
      height
    );

    // Placer les villes
    this.cities = cityPlacer.placeCities(numCities, seed);
  }

  genCountries(width, height, seed) {
    if (!this.cities || !this.cities.cities || this.cities.cities.length === 0) {
      console.warn('⚠️ No cities to generate countries from');
      return;
    }

    // Convertir les maps 2D en 1D
    const heightMap1D = this.getHeightMap1D();
    const climateMap1D = this.getClimateMap1D();
    const biomeMap1D = this.getBiomeMap1D();
    const riverMap1D = this.getRiverMap1D();

    // Créer le générateur de pays
    const countryGenerator = new CountryGenerator(
      heightMap1D,
      climateMap1D,
      biomeMap1D,
      this.cities,
      width,
      height,
      riverMap1D
    );

    // Générer les pays
    this.countries = countryGenerator.generateCountries(seed);
    
    // Mettre à jour les villes avec celles du CountryGenerator (qui inclut les smallVillages ajoutés)
    this.cities.cities = countryGenerator.cities;
    
    // Stocker les données Voronoi pour affichage optionnel
    this.voronoiRegionMap = countryGenerator.voronoiRegionMap;
    this.voronoiPoints = countryGenerator.voronoiPoints;
  }

  genRoutes(width, height, seed) {
    if (!this.cities || !this.cities.cities || this.cities.cities.length === 0) {
      console.warn('⚠️ No cities to generate routes from');
      return;
    }

    if (!this.countries || this.countries.length === 0) {
      console.warn('⚠️ No countries to generate routes from');
      return;
    }

    // Convertir la heightMap en 1D
    const heightMap1D = this.getHeightMap1D();

    // Obtenir la riverMap
    const riverMap1D = this.getRiverMap1D();

    // Créer le générateur de routes
    const routeGenerator = new RouteGenerator(
      this.cities,
      this.countries,
      heightMap1D,
      riverMap1D,
      width,
      height,
      seed
    );

    // Générer les routes
    this.routes = routeGenerator.generateRoutes();
  }

  genReligions(seed) {
    if (!this.cities || !this.cities.cities || this.cities.cities.length === 0) {
      console.warn('⚠️ No cities to generate religions from');
      return;
    }

    if (!this.countries || this.countries.length === 0) {
      console.warn('⚠️ No countries to generate religions from');
      return;
    }

    // Créer le système de religions
    const religionSystem = new ReligionSystem(seed, this);

    // Générer les religions fondamentales
    religionSystem.generateFoundationalReligions();

    // Propager les religions (crée automatiquement religionMap)
    religionSystem.propagateReligions();

    // Générer et propager les cultures
    religionSystem.generateMajorCultures();

    // Stocker le système de religions
    this.religionSystem = religionSystem;
    this.religions = Array.from(religionSystem.religions.values());
    this.cultures = Array.from(religionSystem.cultures.values());
  }
}
