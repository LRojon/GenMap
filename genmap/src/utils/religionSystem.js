// Classe Religion
import { PerlinNoise } from './perlin';

export class Religion {
  constructor(religionId, name, foundingCity, foundingYear, seed, deityTheme = '') {
    this.id = religionId;
    this.name = name;
    this.foundingCity = foundingCity;
    this.foundingYear = foundingYear;
    this.seed = seed;
    this.deityTheme = deityTheme;
    this.events = [];
    this.followers = new Map(); // city_pos_key -> follower_count
    this.schisms = [];
    this.parentReligion = null;
    this.conflictReligions = new Set();
    this.color = this._generateColor();
    this.status = 'active'; // 'active', 'forgotten', or 'secret'
  }

  _generateColor() {
    // Génère une couleur unique basée sur le seed
    let rngState = (this.seed ^ 999) >>> 0;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };

    const r = Math.floor(50 + seededRandom() * 150);
    const g = Math.floor(50 + seededRandom() * 150);
    const b = Math.floor(50 + seededRandom() * 150);
    return `rgb(${r}, ${g}, ${b})`;
  }

  addEvent(year, eventType, description, location) {
    this.events.push({
      year,
      eventType, // 'foundation', 'schism', 'conflict', 'syncretism'
      description,
      location,
    });
  }

  createSchism(schismName, year, location, seed) {
    const schism = new Religion(
      this.schisms.length,
      schismName,
      location,
      year,
      seed,
      this.deityTheme
    );
    schism.parentReligion = this;
    this.schisms.push(schism);
    return schism;
  }
}

// Classe Culture
export class Culture {
  constructor(cultureId, name, seed, originCity, foundingYear = 0, climateType = '') {
    this.id = cultureId;
    this.name = name;
    this.seed = seed;
    this.originCity = originCity; // {name, position: [x, y]}
    this.foundingYear = foundingYear;
    this.climateType = climateType;
    this.traits = {};
    this.influencedBy = []; // culture_ids
    this.color = this._generateColor();
  }

  _generateColor() {
    let rngState = (this.seed ^ 777) >>> 0;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };

    const r = Math.floor(50 + seededRandom() * 150);
    const g = Math.floor(50 + seededRandom() * 150);
    const b = Math.floor(50 + seededRandom() * 150);
    return `rgb(${r}, ${g}, ${b})`;
  }

  addInfluence(otherCultureId) {
    if (!this.influencedBy.includes(otherCultureId)) {
      this.influencedBy.push(otherCultureId);
    }
  }
}

// Classe ReligionSystem
export class ReligionSystem {
  constructor(seed, mapObj) {
    this.seed = seed;
    this.mapObj = mapObj;
    this.religions = new Map();
    this.cultures = new Map();
    this.foundationalReligions = new Map();
    this.majorCultures = new Map();
    this.religionMap = null; // region_id -> religion_id
    this.cultureMap = null; // region_id -> culture_id
  }

  generateFoundationalReligions() {
    /**
     * Crée les religions initiales dans des villes/villages aléatoires
     */
    if (!this.mapObj.cities || !this.mapObj.cities.cities || this.mapObj.cities.cities.length === 0) {
      console.warn('⚠️ No cities to generate religions from');
      return;
    }

    // Sélectionner 5-8 villes/villages aléatoirement
    const allCities = this.mapObj.cities.cities;
    
    let rngState = this.seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };

    // Nombre de religions : 5 à 8
    const numReligions = 5 + Math.floor(seededRandom() * 4);
    
    // Sélectionner des villes aléatoirement sans doublons
    const selectedCities = [];
    const indices = new Set();
    
    while (selectedCities.length < numReligions && selectedCities.length < allCities.length) {
      const randomIdx = Math.floor(seededRandom() * allCities.length);
      if (!indices.has(randomIdx)) {
        const city = allCities[randomIdx];
        selectedCities.push(city);
        indices.add(randomIdx);
      }
    }

    let religionId = 0;

    // Générer une religion par ville sélectionnée
    for (const city of selectedCities) {
      const religionSeed = Math.floor(seededRandom() * (2 ** 31 - 1));

      // Générer nom religieux
      const religionName = this._generateReligionName(religionSeed);

      // Déterminer le thème de déité basé sur le biome
      const deityTheme = this._getDeityThemeFromCity(city);

      // Créer la religion
      const religion = new Religion(
        religionId,
        religionName,
        city.position,
        0, // founding_year
        religionSeed,
        deityTheme
      );

      // Enregistrer événement fondateur
      religion.addEvent(0, 'foundation', `Fondation de ${religionName} à ${city.name}`, city.position);

      this.religions.set(religionId, religion);
      religionId++;
    }

    // Stocker aussi les religions fondamentales
    this.foundationalReligions = new Map(this.religions);
  }

  _generateReligionName(seed) {
    /**
     * Génère un nom de religion aléatoire basé sur un seed
     */
    const prefixes = [
      'L\'Église de',
      'La Vénération de',
      'Le Culte de',
      'La Foi en',
      'La Religion de',
      'La Voie de',
      'Le Chemin de',
      'La Bénédiction de',
    ];

    const deities = [
      'la Lumière Éternelle',
      'l\'Océan Primordial',
      'la Grande Montagne',
      'les Anciens Dieux',
      'la Sagesse Suprême',
      'le Soleil Radieux',
      'la Lune Bienveillante',
      'les Esprits de la Nature',
      'la Force Primordiale',
      'la Trinité Sacrée',
    ];

    let rngState = seed;
    const random = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };

    const prefixIdx = Math.floor(random() * prefixes.length);
    const deityIdx = Math.floor(random() * deities.length);

    return `${prefixes[prefixIdx]} ${deities[deityIdx]}`;
  }

  _getDeityThemeFromCity(city) {
    /**
     * Retourne un thème de déité basé sur le score/biome de la ville
     */
    if (!city) return 'Terre';

    const score = city.score || 0;

    if (score < 30) return 'Marécage';
    if (score < 50) return 'Collines';
    if (score < 70) return 'Prairie';
    if (score < 90) return 'Forêt Sacrée';
    if (score < 110) return 'Montagne';
    return 'Pic Éternel';
  }

  propagateReligions() {
    /**
     * Propage les religions région par région (Voronoi) avec décroissance d'influence
     * En cas de conflit, la religion avec la plus grande influence gagne
     */
    if (!this.mapObj.voronoiPoints || !this.mapObj.voronoiRegionMap || !this.mapObj.cities?.cities) {
      console.warn('⚠️ Missing Voronoi data for religion propagation');
      return;
    }

    const voronoiRegionMap = this.mapObj.voronoiRegionMap;
    const width = this.mapObj.width;
    const height = this.mapObj.height;

    // Étape 1 : Assigner chaque région à sa religion fondatrice
    const regionInfluence = new Map(); // region_id -> Map(religion_id -> influence_value)

    // Initialiser : trouver la région de chaque ville fondatrice
    const foundingRegions = new Map(); // religion_id -> region_id
    
    for (const religion of this.religions.values()) {
      const [startX, startY] = religion.foundingCity;
      const pixelX = Math.floor(startX);
      const pixelY = Math.floor(startY);
      
      // Vérifier que les coordonnées sont valides
      if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
        console.warn(`⚠️ Religion "${religion.name}" founding city at (${pixelX}, ${pixelY}) is out of bounds (map: ${width}x${height})`);
        continue;
      }

      const pixelIdx = pixelY * width + pixelX;
      const regionIdx = voronoiRegionMap[pixelIdx];
      
      if (regionIdx >= 0) {
        foundingRegions.set(religion.id, regionIdx);
        
        // Initialiser l'influence avec 100%
        if (!regionInfluence.has(regionIdx)) {
          regionInfluence.set(regionIdx, new Map());
        }
        regionInfluence.get(regionIdx).set(religion.id, 100);
      } else {
        console.warn(`⚠️ Religion "${religion.name}" could not find its founding region (regionIdx=${regionIdx})`);
      }
    }

    // Étape 2 : BFS région par région avec décroissance d'influence
    const queue = [];
    
    // Initialiser la queue avec les régions fondatrices
    for (const [religionId, regionIdx] of foundingRegions.entries()) {
      queue.push({ regionIdx, religionId, influence: 100 });
    }

    while (queue.length > 0) {
      const { regionIdx, religionId, influence } = queue.shift();

      // Décroissance de l'influence
      const nextInfluence = influence * 0.85; // 15% de perte par région
      
      if (nextInfluence < 0.1) continue; // Seuil minimum plus bas

      // Trouver les régions voisines
      const neighbors = this._findRegionNeighbors(regionIdx, voronoiRegionMap, width);

      for (const neighborRegionIdx of neighbors) {
        // Ajouter/mettre à jour l'influence dans cette région
        if (!regionInfluence.has(neighborRegionIdx)) {
          regionInfluence.set(neighborRegionIdx, new Map());
        }

        const neighborInfluenceMap = regionInfluence.get(neighborRegionIdx);
        const currentInfluence = neighborInfluenceMap.get(religionId) || 0;

        if (nextInfluence > currentInfluence) {
          neighborInfluenceMap.set(religionId, nextInfluence);
          
          // Continuer la propagation
          queue.push({ regionIdx: neighborRegionIdx, religionId, influence: nextInfluence });
        }
      }
    }

    // Étape 3 : Résoudre les conflits - assigner chaque région à la religion avec la plus grande influence
    const regionToReligion = new Map(); // region_id -> religion_id
    const religionRegions = new Map(); // religion_id -> Set(region_ids)

    for (const [regionIdx, influenceMap] of regionInfluence.entries()) {
      let dominantReligion = -1;
      let maxInfluence = 0;

      for (const [religionId, influence] of influenceMap.entries()) {
        if (influence > maxInfluence) {
          maxInfluence = influence;
          dominantReligion = religionId;
        }
      }

      if (dominantReligion >= 0) {
        regionToReligion.set(regionIdx, dominantReligion);
        
        if (!religionRegions.has(dominantReligion)) {
          religionRegions.set(dominantReligion, new Set());
        }
        religionRegions.get(dominantReligion).add(regionIdx);
      }
    }

    // Étape 4 : Gérer les religions sans régions (religions oubliées ou secrètes)
    const forgottenReligions = [];
    const secretReligions = [];
    
    for (const religion of this.religions.values()) {
      const hasRegions = religionRegions.has(religion.id) && religionRegions.get(religion.id).size > 0;
      
      if (!hasRegions) {
        // Choisir aléatoirement si elle devient oubliée ou secrète
        let rngState = religion.seed;
        const seededRandom = () => {
          rngState = (rngState * 1103515245 + 12345) >>> 0;
          return (rngState >>> 0) / 0x100000000;
        };

        if (seededRandom() < 0.5) {
          forgottenReligions.push(religion);
          religion.status = 'forgotten';
        } else {
          secretReligions.push(religion);
          religion.status = 'secret';
        }
      }
    }

    // Stocker les données
    this.religionMap = regionToReligion;
    this.religionRegions = religionRegions;
    this.forgottenReligions = forgottenReligions;
    this.secretReligions = secretReligions;
  }

  _findRegionNeighbors(regionIdx, voronoiRegionMap, width) {
    /**
     * Trouve les régions voisines d'une région donnée
     */
    const neighbors = new Set();

    // Chercher tous les pixels de cette région et leurs voisins
    for (let pixelIdx = 0; pixelIdx < voronoiRegionMap.length; pixelIdx++) {
      if (voronoiRegionMap[pixelIdx] !== regionIdx) continue;

      const x = pixelIdx % width;
      const y = Math.floor(pixelIdx / width);

      // Vérifier les 4 voisins (haut, bas, gauche, droite)
      const directions = [
        (y - 1) * width + x, // haut
        (y + 1) * width + x, // bas
        y * width + (x - 1), // gauche
        y * width + (x + 1), // droite
      ];

      for (const neighborPixelIdx of directions) {
        if (neighborPixelIdx >= 0 && neighborPixelIdx < voronoiRegionMap.length) {
          const neighborRegionIdx = voronoiRegionMap[neighborPixelIdx];
          if (neighborRegionIdx !== regionIdx) {
            neighbors.add(neighborRegionIdx);
          }
        }
      }
    }

    return Array.from(neighbors);
  }

  _calculateDistance(pos1, pos2) {
    /**
     * Calcule distance euclidienne
     */
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  generateMajorCultures() {
    /**
     * Génère les cultures basées sur du bruit de Perlin
     * Chaque culture a son propre champ de bruit Perlin
     * Les cultures ont des villes comme origines
     * Pour chaque pixel: on prend la culture avec la plus grande influence
     */
    if (!this.mapObj.width || !this.mapObj.height || !this.mapObj.voronoiRegionMap) {
      console.warn('⚠️ Missing map data for culture generation');
      return;
    }

    if (!this.mapObj.cities || !this.mapObj.cities.cities || this.mapObj.cities.cities.length === 0) {
      console.warn('⚠️ No cities to generate cultures from');
      return;
    }

    const width = this.mapObj.width;
    const height = this.mapObj.height;
    const mapData = this.mapObj.getHeightMap1D ? this.mapObj.getHeightMap1D() : new Uint8Array(width * height);
    const voronoiRegionMap = this.mapObj.voronoiRegionMap;
    const SEA_LEVEL = 127;
    const allCities = this.mapObj.cities.cities;

    // Déterminer nombre de cultures
    let numTerrestrialRegions = new Set();
    for (let pixelIdx = 0; pixelIdx < voronoiRegionMap.length; pixelIdx++) {
      if (mapData[pixelIdx] > SEA_LEVEL) {
        numTerrestrialRegions.add(voronoiRegionMap[pixelIdx]);
      }
    }
    
    const numCultures = Math.max(3, Math.min(8, 3 + Math.floor((numTerrestrialRegions.size - 50) / 50)));

    // Sélectionner aléatoirement N villes comme origines des cultures
    let rngState = this.seed;
    const seededRandom = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };

    // Catégoriser les villes par terrain (pour diversifier les cultures)
    const citiesByTerrain = {
      coastal: [],
      mountain: [],
      forest: [],
      plains: [],
      desert: []
    };

    for (const city of allCities) {
      const cityPixelIdx = city.position[1] * width + city.position[0];
      const regionId = voronoiRegionMap[cityPixelIdx];
      const biome = this._getBiomeVariantForRegion(regionId, voronoiRegionMap, mapData, city.position, width);
      
      if (citiesByTerrain[biome]) {
        citiesByTerrain[biome].push(city);
      }
    }

    // Sélectionner des villes de différents terrains pour créer une diversité
    const selectedCities = [];
    const indices = new Set();
    const terrainTypes = Object.keys(citiesByTerrain).filter(t => citiesByTerrain[t].length > 0);

    // Distribuer les cultures parmi les terrains disponibles
    for (let cultureId = 0; cultureId < numCultures; cultureId++) {
      // Choisir un terrain (en cycle)
      const terrainIdx = cultureId % terrainTypes.length;
      const terrain = terrainTypes[terrainIdx];
      const citiesInTerrain = citiesByTerrain[terrain];

      if (citiesInTerrain.length > 0) {
        // Choisir une ville aléatoire dans ce terrain
        const randomCityIdx = Math.floor(seededRandom() * citiesInTerrain.length);
        const selectedCity = citiesInTerrain[randomCityIdx];
        
        // Vérifier qu'on ne l'a pas déjà sélectionnée
        const cityIdx = allCities.indexOf(selectedCity);
        if (!indices.has(cityIdx)) {
          selectedCities.push(selectedCity);
          indices.add(cityIdx);
        } else {
          // Si déjà sélectionnée, chercher une autre dans un terrain différent
          let found = false;
          for (const fallbackTerrain of terrainTypes) {
            for (const fallbackCity of citiesByTerrain[fallbackTerrain]) {
              const fbIdx = allCities.indexOf(fallbackCity);
              if (!indices.has(fbIdx)) {
                selectedCities.push(fallbackCity);
                indices.add(fbIdx);
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
      }
    }

    // Créer les cultures avec leurs champs de bruit Perlin
    const cultureNoises = new Map(); // culture_id -> noise_grid (Uint8Array)

    for (let cultureId = 0; cultureId < numCultures; cultureId++) {
      // Générer un bruit de Perlin unique pour cette culture
      const cultureSeed = this.seed ^ (cultureId * 777);
      const perlinNoise = new PerlinNoise(cultureSeed);

      // Générer la grille de bruit (normalisée 0-255)
      const noiseGrid = new Uint8Array(width * height);
      const scale = 0.008; // Même scale que Python
      const octaves = 6;
      const persistence = 0.6;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let value = 0;
          let maxValue = 0;
          let currentAmplitude = 1;
          let currentFrequency = 1;

          // Multi-octave noise
          for (let i = 0; i < octaves; i++) {
            const sampleX = (x * scale) * currentFrequency;
            const sampleY = (y * scale) * currentFrequency;
            
            value += perlinNoise.noise(sampleX, sampleY) * currentAmplitude;
            maxValue += currentAmplitude;

            currentAmplitude *= persistence;
            currentFrequency *= 2;
          }

          // Normaliser entre 0 et 255
          const normalized = (value / maxValue + 1) / 2; // Passer de [-1,1] à [0,1]
          noiseGrid[y * width + x] = Math.floor(Math.max(0, Math.min(255, normalized * 255)));
        }
      }

      cultureNoises.set(cultureId, noiseGrid);

      // Créer l'objet culture
      const cultureName = this._generateCultureName(cultureSeed);
      const originCity = selectedCities[cultureId];

      // Déterminer le climat basé sur la ville d'origine (analyser un périmètre autour de la ville)
      const originCityRegionId = voronoiRegionMap[originCity.position[1] * width + originCity.position[0]];
      const climateType = this._getBiomeVariantForRegion(originCityRegionId, voronoiRegionMap, mapData, originCity.position, width);

      const cultureObj = new Culture(
        cultureId,
        cultureName,
        cultureSeed,
        originCity,
        originCity.founded_year || 0,
        climateType || 'plains'
      );

      // Ajouter les traits culturels
      const climateStr = climateType || 'plains';
      cultureObj.traits.values = this._generateCulturalValues(climateStr);
      cultureObj.traits.architecture = this._generateArchitecture(climateStr);
      cultureObj.traits.symbols = this._generateSymbols(climateStr);

      this.cultures.set(cultureId, cultureObj);
      this.majorCultures.set(cultureId, cultureObj);
    }

    // Créer la carte de cultures pixel par pixel (pixel_idx -> culture_id)
    const culturePixelMap = new Uint8Array(width * height); // Pour chaque pixel, l'ID de la culture (-1 si aucune)
    culturePixelMap.fill(255); // 255 = pas de culture

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIdx = y * width + x;
        
        // Vérifier si ce pixel est sur terre (pas dans l'eau)
        if (mapData[pixelIdx] <= SEA_LEVEL) {
          continue; // Ignorer l'eau
        }

        let maxInfluence = 0;
        let winningCultureId = 0;

        // Trouver la culture avec l'influence la plus forte
        for (let cultureId = 0; cultureId < numCultures; cultureId++) {
          const noiseGrid = cultureNoises.get(cultureId);
          const influence = noiseGrid[pixelIdx];
          
          if (influence > maxInfluence) {
            maxInfluence = influence;
            winningCultureId = cultureId;
          }
        }

        // Assigner ce pixel à cette culture
        culturePixelMap[pixelIdx] = winningCultureId;
      }
    }

    // Stocker le mapping
    this.culturePixelMap = culturePixelMap;
  }

  _generateCultureName(seed) {
    /**
     * Génère un nom de culture aléatoire basé sur un seed
     */
    const prefixes = [
      'les', 'la', 'le', 'del', 'da', 'der', 'des', 'la', 'lo', 'le'
    ];

    const roots = [
      'Keim', 'Voll', 'Stor', 'Glas', 'Mark', 'Burg', 'Feld', 'Wald', 'Berg',
      'See', 'Fluss', 'Tal', 'Stein', 'Gold', 'Silber', 'Eisen', 'Sand', 'Wind',
      'Sonne', 'Mond', 'Stern', 'Feuille', 'Racine', 'Fleuve', 'Montagne'
    ];

    const suffixes = [
      'ien', 'ans', 'ois', 'eurs', 'eth', 'ath', 'oth', 'ith', 'ade', 'ara',
      'ara', 'uri', 'oni', 'eni', 'arn', 'och', 'ich', 'osch'
    ];

    let rngState = seed;
    const random = () => {
      rngState = (rngState * 1103515245 + 12345) >>> 0;
      return (rngState >>> 0) / 0x100000000;
    };

    const prefixIdx = Math.floor(random() * prefixes.length);
    const rootIdx = Math.floor(random() * roots.length);
    const suffixIdx = Math.floor(random() * suffixes.length);

    const prefix = prefixes[prefixIdx];
    const root = roots[rootIdx];
    const suffix = suffixes[suffixIdx];

    return `${prefix} ${root}${suffix}`.charAt(0).toUpperCase() + `${prefix} ${root}${suffix}`.slice(1);
  }

  _getBiomeVariantForRegion(regionId, voronoiRegionMap, mapData, cityPosition = null, width = null) {
    /**
     * Détermine la variante biome d'une région
     * Si cityPosition est fourni, analyse un périmètre autour de la ville
     * Sinon, analyse toute la région
     * width: la largeur réelle de la map (si null, essaie de la calculer)
     */
    const SEA_LEVEL = 127;
    
    // Calculer la largeur si non fournie
    if (width === null) {
      width = Math.sqrt(voronoiRegionMap.length);
    }
    
    // Compter pixels par type d'altitude
    let seaCount = 0;
    let mountainCount = 0;
    let altitudes = [];
    let pixelsToAnalyze = [];

    if (cityPosition) {
      // Analyser un périmètre de 64 pixels autour de la ville
      const radius = 64;
      const [cityX, cityY] = cityPosition;
      const minX = Math.max(0, cityX - radius);
      const maxX = Math.min(width - 1, cityX + radius);
      const minY = Math.max(0, cityY - radius);
      const height = voronoiRegionMap.length / width;
      const maxY = Math.min(height - 1, cityY + radius);

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const pixelIdx = Math.floor(y) * width + Math.floor(x);
          if (pixelIdx >= 0 && pixelIdx < voronoiRegionMap.length) {
            pixelsToAnalyze.push(pixelIdx);
          }
        }
      }
      
    } else {
      // Analyser toute la région
      for (let pixelIdx = 0; pixelIdx < voronoiRegionMap.length; pixelIdx++) {
        if (voronoiRegionMap[pixelIdx] === regionId) {
          pixelsToAnalyze.push(pixelIdx);
        }
      }
    }

    // Compter les types d'altitude
    for (const pixelIdx of pixelsToAnalyze) {
      const altitude = mapData[pixelIdx];
      altitudes.push(altitude);

      if (altitude <= SEA_LEVEL) {
        seaCount++;
      } else if (altitude > 180) {
        mountainCount++;
      }
    }

    if (altitudes.length === 0) return 'plains';

    const avgAltitude = altitudes.reduce((a, b) => a + b, 0) / altitudes.length;

    // Déterminer le biome
    const biomeResult = seaCount > altitudes.length * 0.3 ? 'coastal' 
                      : mountainCount > altitudes.length * 0.3 ? 'mountain'
                      : avgAltitude < 140 ? 'forest'
                      : avgAltitude > 170 ? 'desert'
                      : 'plains';
    
    return biomeResult;
  }

  _generateCulturalValues(climateType) {
    /**
     * Génère les valeurs culturelles selon le type de climat
     */
    const valuesMap = {
      desert: 'Survie, Honneur, Tradition',
      mountain: 'Force, Spiritualité, Indépendance',
      forest: 'Harmonie, Mystère, Liberté',
      plains: 'Commerce, Hospitalité, Communauté',
      coastal: 'Aventure, Échange, Audace',
    };
    return valuesMap[climateType] || 'Équilibre, Sagesse';
  }

  _generateArchitecture(climateType) {
    /**
     * Génère le style architectural selon le type de climat
     */
    const architectureMap = {
      desert: 'Adobe et pierre, tours défensives',
      mountain: 'Pierre massive, fortifications',
      forest: 'Bois travaillé, intégration nature',
      plains: 'Briques, structures ouvertes',
      coastal: 'Bois et corail, ports',
    };
    return architectureMap[climateType] || 'Architecture mixte';
  }

  _generateSymbols(climateType) {
    /**
     * Génère les symboles culturels selon le type de climat
     */
    const symbolsMap = {
      desert: '☀️ Soleil, 🐪 Chameau, 🌵 Dune',
      mountain: '⛰️ Montagne, 🦅 Aigle, ❄️ Cristal',
      forest: '🌲 Arbre, 🦌 Cerf, 🌿 Feuille',
      plains: '🌾 Blé, 🐴 Cheval, 🌅 Horizon',
      coastal: '🌊 Vague, 🐚 Coquille, ⛵ Bateau',
    };
    return symbolsMap[climateType] || '✨ Étoile, 🔮 Destin';
  }
}
