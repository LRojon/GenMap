import { SEA_LEVEL } from './constants.js';
import { getNextSeed } from './seedGenerator.js';
import { ProcNameGenerator, City } from './cities.js';
import { VoronoiCell } from './voronoiCell.js';
import { PerlinNoise } from './perlin.js';




// Classe Country
export class Country {
  constructor(id, capitalCity, seed = 0) {
    this.id = id;
    this.capitalCity = capitalCity;
    this.seed = seed;
    this.name = ProcNameGenerator.generateCountryName(seed);
    this.color = this._generateColor(seed);
    this.pixels = []; // Indices 1D des pixels
    this.cities = [capitalCity]; // Liste des villes du pays
    this.population = capitalCity.population;
    this.area = 0;
    this.mainBiome = capitalCity.biome;
    this.mainClimate = capitalCity.climate;
  }

  _generateColor(seed) {
    // Couleur HSL déterministe basée sur seed
    const h = (seed * 137.508) % 360; // Golden angle pour distribution uniforme
    const s = 70 + ((seed * 12345) % 20); // 70-90% saturation
    const l = 50 + ((seed * 54321) % 15); // 50-65% lightness
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  addPixel(pixelIndex) {
    this.pixels.push(pixelIndex);
    this.area++;
  }

  addCity(city) {
    if (!this.cities.includes(city)) {
      this.cities.push(city);
      this.population += city.population;
    }
  }

  removeCity(city) {
    const idx = this.cities.indexOf(city);
    if (idx > -1) {
      this.cities.splice(idx, 1);
      this.population -= city.population;
    }
  }
}

// Classe principale pour génération des pays
export class CountryGenerator {
  constructor(heightMap, climateMap, biomeMap, cities, width, height, riverMap = null, options = {}, cityCandidates = null) {
    this.heightMap = heightMap;
    this.climateMap = climateMap;
    this.biomeMap = biomeMap;
    this.riverMap = riverMap;
    this.cities = cities.cities; // Array de City objects
    this.width = width;
    this.height = height;
    this.countries = [];
    
    // ⚡ Candidats de CityPlacer pour les smallvillages
    this.cityCandidates = cityCandidates || [];
    
    // Influence map: [influence, countryId] pour chaque pixel
    this.influenceMap = new Array(width * height);
    for (let i = 0; i < width * height; i++) {
      this.influenceMap[i] = [0, -1]; // [influence, countryId]
    }
    
    // Options de perturbation des frontières
    this.borderPerturbationEnabled = options.borderPerturbationEnabled !== false; // true par défaut
    this.perturbationAmount = options.perturbationAmount ?? 0.15; // [0-1] : 0.15 = 15% de variation
    this.perturbationScale = options.perturbationScale ?? 30; // Fréquence du bruit (pixels)
    this.perturbationOctaves = options.perturbationOctaves ?? 2; // Nombre de couches de bruit
  }

  /**
   * Nettoie la mémoire après génération
   * Supprime les structures temporaires volumineuses
   * Garde voronoiRegionMap car il est utilisé par ReligionSystem
   */
  cleanup() {
    // Supprimer les cartes temporaires (occupent beaucoup de RAM)
    // NOTE: garder voronoiRegionMap pour ReligionSystem.propagateReligions()
    this.influenceMap = null;
  }

  generateCountries(seed = 0) {
    const countryStart = performance.now();

    // Étape 0: Calculer le nombre de pays et sélectionner les capitales
    const capitalCities = this._selectCapitalCities(seed);

    // Étape 0.5: Générer les petits villages AVANT les pays (pour inclusion dans Voronoi)
    this._generateSmallVillages(seed, capitalCities.length);

    // Étape 1: Créer un pays pour chaque capitale
    this._initializeCountries(capitalCities, seed);

    // Étape 2: NOUVELLE APPROCHE - Générer Voronoi avec points supplémentaires (incluant smallVillages)
    const step2Start = performance.now();
    this._generateVoronoiWithAdditionalPoints(seed);
    const step2Time = performance.now() - step2Start;
    console.log(`%c  → Voronoi: ${step2Time.toFixed(2)}ms`, 'color: #667eea;');

    // Étape 3: Assigner les pixels aux pays via Voronoi direct
    const step3Start = performance.now();
    this._assignPixelsThroughVoronoi();
    const step3Time = performance.now() - step3Start;
    console.log(`%c  → Assign pixels: ${step3Time.toFixed(2)}ms`, 'color: #667eea;');

    // Étape 4: Gérer les îles
    const step4Start = performance.now();
    this._handleIslands();
    const step4Time = performance.now() - step4Start;
    console.log(`%c  → Handle islands: ${step4Time.toFixed(2)}ms`, 'color: #667eea;');

    // Étape 5: Réassigner les villes capturées
    const step5Start = performance.now();
    this._reassignCapturedCities();
    const step5Time = performance.now() - step5Start;
    console.log(`%c  → Reassign cities: ${step5Time.toFixed(2)}ms`, 'color: #667eea;');

    const countryTime = performance.now() - countryStart;
    console.log(`%c✓ Countries generated in ${countryTime.toFixed(2)}ms`, 'color: #48bb78;');

    // Nettoyer la mémoire temporaire (sauf voronoiRegionMap)
    this.cleanup();

    return this.countries;
  }

  _generateSmallVillages(seed, numCountries) {
    /**
     * Génère des petits villages à partir des candidats CityPlacer
     * ⚡ SUPER OPTIMISÉ: Réutiliser les candidats au lieu de rescanner!
     * Les candidats viennent du scan tous les 5 pixels des villes principales
     */
    
    // Utiliser les candidats du CityPlacer (déjà filtrés, déjà scorés)
    let villagePositions = this.cityCandidates && this.cityCandidates.length > 0 
      ? [...this.cityCandidates]  // Copie pour ne pas modifier l'original
      : [];
    
    // Si pas de candidats, fallback vide (les villes principales suffisent)
    if (villagePositions.length === 0) {
      return;
    }
    
    let rngState = seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };
    
    // Nombre total de villages à générer (3-5 par pays)
    const villageBaseSeed = getNextSeed(seed, 999);
    let numVillagesRngState = villageBaseSeed;
    const numVillagesRandom = () => {
      numVillagesRngState = (numVillagesRngState * 1103515245 + 12345) >>> 0;
      return (numVillagesRngState >>> 0) / 0x100000000;
    };
    
    const totalVillagesToGenerate = numCountries * (3 + Math.floor(numVillagesRandom() * 3)); // 3-5 par pays
    
    // Sélectionner aléatoirement N villages parmi les candidats
    const placedVillages = [];
    const minDistanceVillages = 30; // Minimum entre deux villages
    
    for (let v = 0; v < totalVillagesToGenerate && villagePositions.length > 0; v++) {
      const villageSeed = getNextSeed(villageBaseSeed, v + 1);
      
      // Sélection pondérée par score (bas score = plus probable pour villages)
      const totalWeight = villagePositions.reduce((sum, [, , , score]) => sum + Math.max(0, 100 - score), 0);
      
      if (totalWeight <= 0) break;
      
      let rand = seededRandom() * totalWeight;
      let cumulative = 0;
      let selectedIdx = -1;
      
      for (let i = 0; i < villagePositions.length; i++) {
        const [, , , score] = villagePositions[i];
        const weight = Math.max(0, 100 - score);
        cumulative += weight;
        if (cumulative >= rand) {
          selectedIdx = i;
          break;
        }
      }
      
      if (selectedIdx === -1) break;
      
      const [pixelIdx, x, y, score] = villagePositions[selectedIdx];
      
      // Vérifier distance min avec autres villages placés
      let tooCloseToOtherVillage = false;
      for (const [placeX, placeY] of placedVillages) {
        const dist = Math.hypot(placeX - x, placeY - y);
        if (dist < minDistanceVillages) {
          tooCloseToOtherVillage = true;
          break;
        }
      }
      
      if (tooCloseToOtherVillage) {
        // Supprimer ce candidat et continuer
        villagePositions.splice(selectedIdx, 1);
        continue;
      }
      
      // Position valide, créer le village
      const altitude = this.heightMap[pixelIdx];
      const climate = this.climateMap[pixelIdx];
      const village = new City(
        [x, y],
        villageSeed,
        altitude,
        climate,
        this.biomeMap[pixelIdx]
      );
      
      village.score = score;
      village.generateFullData();
      
      this.cities.push(village);
      placedVillages.push([x, y]);
      
      // Supprimer les candidats proches de celui-ci
      const newPositions = [];
      for (const [pIdx, pX, pY, pScore] of villagePositions) {
        const dist = Math.abs(pX - x) + Math.abs(pY - y);
        if (dist >= minDistanceVillages) {
          newPositions.push([pIdx, pX, pY, pScore]);
        }
      }
      villagePositions.splice(0, villagePositions.length, ...newPositions);
    }
  }

  _selectCapitalCities(seed) {
    // Calculer le nombre de pays
    const area = this.width * this.height;
    const baseCountries = Math.floor(area / 25000);
    
    // Variation aléatoire déterministe ±30%
    let rngState = seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };
    
    const variation = 0.7 + seededRandom() * 0.6; // Entre 0.7 et 1.3
    const numCountries = Math.max(3, Math.floor(baseCountries * variation));

    // Trier les villes par score décroissant
    const sortedCities = [...this.cities].sort((a, b) => b.score - a.score);

    // Prendre les X meilleures villes comme capitales
    const capitalCities = sortedCities.slice(0, Math.min(numCountries, sortedCities.length));

    return capitalCities;
  }

  _initializeCountries(capitalCities, seed) {
    for (let i = 0; i < capitalCities.length; i++) {
      const city = capitalCities[i];
      const citySeed = getNextSeed(seed, i);
      const country = new Country(i, city, citySeed);
      this.countries.push(country);
    }
  }

  _generateVoronoiWithAdditionalPoints(seed) {
    /**
     * Étape 2: Générer Voronoi avec structure VoronoiCell
     * - Positions des villes
     * - Positions des smallVillages
     * - Points supplémentaires proportionnels à la superficie
     */
    
    // Collecter tous les points Voronoi
    const voronoiPoints = [];
    
    // Ajouter toutes les villes et smallVillages
    for (const city of this.cities) {
      voronoiPoints.push(city.position);
    }
    
    // Calculer le nombre de points supplémentaires proportionnels à la superficie
    const area = this.width * this.height;
    const baseAdditionalPoints = Math.floor(area / 8000); // ~1 point par 8000 pixels
    
    let rngState = seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };
    
    // Générer les points supplémentaires aléatoires
    for (let i = 0; i < baseAdditionalPoints; i++) {
      const x = Math.floor(seededRandom() * this.width);
      const y = Math.floor(seededRandom() * this.height);
      voronoiPoints.push([x, y]);
    }
    
    // ⚡ Créer les cellules Voronoi
    this.voronoiCells = new Array(voronoiPoints.length);
    for (let i = 0; i < voronoiPoints.length; i++) {
      const [x, y] = voronoiPoints[i];
      this.voronoiCells[i] = new VoronoiCell(i, x, y);
    }
    
    // Créer la carte Voronoi simple (closest point)
    this.voronoiRegionMap = new Uint32Array(this.width * this.height);
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        let closestIdx = 0;
        let closestDist = Infinity;
        
        for (let i = 0; i < voronoiPoints.length; i++) {
          const [px, py] = voronoiPoints[i];
          const dx = px - x;
          const dy = py - y;
          const dist = dx * dx + dy * dy;
          
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
        
        this.voronoiRegionMap[y * this.width + x] = closestIdx;
      }
    }
    
    // ⚡ Calculer les voisins et les stocker dans les VoronoiCell
    // En même temps, ajouter les pixels aux cellules
    const neighborsSet = new Array(voronoiPoints.length);
    for (let i = 0; i < voronoiPoints.length; i++) {
      neighborsSet[i] = new Set();
    }
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixelIdx = y * this.width + x;
        const regionIdx = this.voronoiRegionMap[pixelIdx];
        
        // Ajouter le pixel à la cellule
        this.voronoiCells[regionIdx].addPixel(pixelIdx);
        
        // Vérifier les 4 voisins pour détecter les arêtes
        const neighbors4 = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];
        
        for (const [nx, ny] of neighbors4) {
          if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
          
          const neighborPixelIdx = ny * this.width + nx;
          const neighborRegionIdx = this.voronoiRegionMap[neighborPixelIdx];
          
          if (neighborRegionIdx !== regionIdx) {
            neighborsSet[regionIdx].add(neighborRegionIdx);
            neighborsSet[neighborRegionIdx].add(regionIdx);
          }
        }
      }
    }
    
    // ⚡ Ajouter les voisins aux cellules Voronoi
    for (let i = 0; i < voronoiPoints.length; i++) {
      for (const neighborId of neighborsSet[i]) {
        this.voronoiCells[i].addNeighbor(neighborId);
      }
    }
    
    this.voronoiPoints = voronoiPoints;
  }

  _assignPixelsThroughVoronoi() {
    /**
     * Étape 3: Assigner les pixels aux pays via influence directe + Perlin + direction préférée
     * ⚡ NATUREL: Approche directe avec direction préférée pour chaque pays
     * Chaque pays a une direction préférée basée sur son Perlin
     * Cela crée des expansions directionnelles plus réalistes
     */
    
    const width = this.width;
    const height = this.height;
    const seed = this.seed || 12345;
    
    // Pré-calculer les données de chaque pays + direction préférée
    const countryData = [];
    for (let countryIdx = 0; countryIdx < this.countries.length; countryIdx++) {
      const country = this.countries[countryIdx];
      const capital = country.capitalCity;
      const [cx, cy] = capital.position;
      
      const countrySeed = seed ^ (countryIdx * 777);
      const perlinNoise = new PerlinNoise(countrySeed);
      
      // Calculer la direction préférée basée sur le Perlin à la capitale
      const perlinScale = 25;
      const directionNoise = perlinNoise.octaveNoise(cx / perlinScale, cy / perlinScale, 6);
      const directionAngle = (directionNoise + 1) * Math.PI; // Angle 0 à 2π
      const directionX = Math.cos(directionAngle);
      const directionY = Math.sin(directionAngle);
      
      countryData.push({
        countryId: countryIdx,
        capitalX: cx,
        capitalY: cy,
        capitalScore: capital.score || 100,
        perlinNoise,
        directionX,  // Direction préférée (cosine)
        directionY,  // Direction préférée (sine)
      });
    }
    
    const pixelCountry = new Int32Array(width * height);
    pixelCountry.fill(-1);
    
    // ⚡ APPROCHE DIRECTE avec direction préférée: Pour chaque pixel, trouver le pays avec la plus haute influence
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = y * width + x;
        const altitude = this.heightMap[pixelIdx];
        
        // Ignorer l'eau
        if (altitude <= SEA_LEVEL) continue;
        
        let maxInfluence = -Infinity;
        let bestCountry = -1;
        
        // Calculer l'influence de chaque pays pour ce pixel
        for (const data of countryData) {
          // Distance² à la capitale
          const dx = x - data.capitalX;
          const dy = y - data.capitalY;
          const distSq = dx * dx + dy * dy;
          const distFactor = 1 / (1 + distSq * 0.001);  // Décroissance avec distance
          
          // Bruit Perlin du pays
          const perlinScale = 25;
          const noiseValue = data.perlinNoise.octaveNoise(x / perlinScale, y / perlinScale, 6);
          const noiseNormalized = (noiseValue + 1) / 2; // [0, 1]
          
          // Direction préférée: bonus si le pixel est dans la direction préférée du pays
          // Calculer l'angle du pixel par rapport à la capitale
          const pixelAngle = Math.atan2(dy, dx);
          const preferredAngle = Math.atan2(data.directionY, data.directionX);
          
          // Différence d'angle (0 = aligné, π = opposé)
          let angleDiff = Math.abs(pixelAngle - preferredAngle);
          if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
          }
          
          // Bonus si dans la direction préférée (cosinus de l'angle)
          const directionBonus = Math.cos(angleDiff) * 50; // -50 à +50
          
          // Influence totale = distance (DOMINANTE) + Perlin + direction préférée + capital score
          const influence = (distFactor * 200) + (noiseNormalized * 30) + directionBonus + (data.capitalScore * 0.5);
          
          if (influence > maxInfluence) {
            maxInfluence = influence;
            bestCountry = data.countryId;
          }
        }
        
        // Assigner le pixel au meilleur pays
        if (bestCountry >= 0) {
          pixelCountry[pixelIdx] = bestCountry;
          this.countries[bestCountry].addPixel(pixelIdx);
        }
      }
    }
  }

  _computeVoronoiNeighbors() {
    /**
     * Calcule les voisins des régions Voronoi
     * Deux régions sont voisines si elles partagent une bordure (pixel voisin)
     */
    const neighbors = new Map();
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const pixelIdx = y * this.width + x;
        const regionIdx = this.voronoiRegionMap[pixelIdx];
        
        // Vérifier les 4 voisins
        const neighborCoords = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ];
        
        for (const [nx, ny] of neighborCoords) {
          if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;
          
          const neighborPixelIdx = ny * this.width + nx;
          const neighborRegionIdx = this.voronoiRegionMap[neighborPixelIdx];
          
          if (neighborRegionIdx !== regionIdx) {
            // Ces deux régions sont voisines
            if (!neighbors.has(regionIdx)) {
              neighbors.set(regionIdx, new Set());
            }
            neighbors.get(regionIdx).add(neighborRegionIdx);
          }
        }
      }
    }
    
    return neighbors;
  }

  _handleIslands() {
    // Islands handled via Voronoi-based approach
  }

  _reassignCapturedCities() {
    // Pour chaque ville, vérifier si elle appartient à un pays
    // Les villes appartiennent déjà aux pays via la région Voronoi
    for (let cityIdx = 0; cityIdx < this.cities.length; cityIdx++) {
      const city = this.cities[cityIdx];
      const [x, y] = city.position;
      const pixelIdx = y * this.width + x;
      const regionIdx = this.voronoiRegionMap[pixelIdx];
      
      // Trouver quel pays possède cette région
      let ownerCountryId = -1;
      for (let countryIdx = 0; countryIdx < this.countries.length; countryIdx++) {
        // Vérifier si cette région appartient au pays
        const hasPixel = this.countries[countryIdx].pixels.some(p => 
          this.voronoiRegionMap[p] === regionIdx
        );
        if (hasPixel) {
          ownerCountryId = countryIdx;
          break;
        }
      }
      
      if (ownerCountryId >= 0) {
        const ownerCountry = this.countries[ownerCountryId];
        if (!ownerCountry.cities.includes(city)) {
          ownerCountry.addCity(city);
        }
      }
    }
  }

  _calculateLocationScore(altitude, climate) {
    // Calcule le score potentiel d'un emplacement basé sur altitude et climat
    // Similar to CityPlacer._calculatePixelScore
    
    if (altitude <= 0.4) {
      return 0; // Eau = score 0
    }
    
    if (altitude > 180 / 255) { // Montagne trop haute (normalisée)
      return 0; // Score 0
    }

    let score = 50;

    // Bonus altitude favorable (130-160 normalisé = 0.51-0.63)
    const altNorm = altitude * 255;
    if (altNorm >= 130 && altNorm <= 160) {
      score += 40;
    } else if (altNorm > 160 && altNorm <= 170) {
      score += 20;
    }

    // Pénalité altitude très élevée
    if (altNorm > 170) {
      score -= (altNorm - 170) * 0.3;
    }

    // Bonus/pénalité selon le climat (normalisé 0-255)
    const climateNorm = climate * 255;
    if (climateNorm < 85) {
      score -= 40; // Polaire
    } else if (climateNorm < 127) {
      score += 30; // Tempéré froid
    } else if (climateNorm < 170) {
      score += 50; // Tempéré chaud
    } else if (climateNorm < 210) {
      score += 20; // Tropical
    } else {
      score -= 30; // Désertique
    }

    // Score minimum 20 pour assurer une population positive
    return Math.max(20, score);
  }
}
