import { SEA_LEVEL } from './constants.js';
import { PerlinNoise } from './perlin.js';

export class RouteGenerator {
  constructor(cities, countries, heightMap, riverMap, width, height, seed = 0) {
    this.cities = cities.cities;
    this.countries = countries;
    this.heightMap = heightMap;
    this.riverMap = riverMap;
    this.width = width;
    this.height = height;
    this.seed = seed;
    this.perlinNoise = new PerlinNoise(seed);
    this.perlinGrid = null;
    this.routes = [];
    this.stepSize = 1.5;
  }

  generateRoutes() {
    const routeStart = performance.now();

    if (this.cities.length < 2) {
      return this.routes;
    }

    this._initializePerlinGrid();

    let edges = this._delaunayTriangulation();
    edges = this._filterByMaxDegree(edges, 4);
    edges = this._validateEdges(edges);
    edges = this._ensureConnectivity(edges);
    this._createRoutesFromEdges(edges);
    this._validateRoutes();

    const routeTime = performance.now() - routeStart;

    return this.routes;
  }

  _initializePerlinGrid() {
    if (this.perlinGrid) return;

    this.perlinGrid = new Array(this.height);
    const octaves = 6;
    const persistence = 0.35;
    const scale = 0.05;
    
    for (let y = 0; y < this.height; y++) {
      this.perlinGrid[y] = new Array(this.width);
      for (let x = 0; x < this.width; x++) {
        this.perlinGrid[y][x] = this.perlinNoise.octaveNoise(
          x, y, octaves, persistence, scale
        );
      }
    }
  }

  _delaunayTriangulation() {
    const positions = this.cities.map(c => c.position);
    const n = positions.length;
    const edges = [];

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dist = this._distance(positions[i], positions[j]);
        edges.push([i, j, dist]);
      }
    }

    edges.sort((a, b) => a[2] - b[2]);
    const maxEdges = Math.ceil(this.cities.length * 2.5);
    return edges.slice(0, maxEdges).map(([i, j]) => [i, j]);
  }

  _filterByMaxDegree(edges, maxDegree) {
    const degree = new Map();
    const filtered = [];

    for (let i = 0; i < this.cities.length; i++) {
      degree.set(i, 0);
    }

    const edgesWithDist = edges.map(([i, j]) => [i, j, this._distance(this.cities[i].position, this.cities[j].position)]);
    edgesWithDist.sort((a, b) => a[2] - b[2]);

    for (const [i, j] of edgesWithDist) {
      // Déterminer le maxDegree pour chaque ville
      // Villages (score < 100) : maxDegree = 2
      // Grandes villes (score >= 100) : maxDegree = 4
      const maxDegreeI = this.cities[i].score < 100 ? 2 : maxDegree;
      const maxDegreeJ = this.cities[j].score < 100 ? 2 : maxDegree;

      if (degree.get(i) < maxDegreeI && degree.get(j) < maxDegreeJ) {
        filtered.push([i, j]);
        degree.set(i, degree.get(i) + 1);
        degree.set(j, degree.get(j) + 1);
      }
    }

    return filtered;
  }

  _validateEdges(edges) {
    const valid = [];

    for (const [i, j] of edges) {
      const pos1 = this.cities[i].position;
      const pos2 = this.cities[j].position;

      if (this._checkEdgeValidity(pos1, pos2)) {
        valid.push([i, j]);
      }
    }

    return valid;
  }

  _checkEdgeValidity(pos1, pos2) {
    const [x1, y1] = pos1;
    const [x2, y2] = pos2;

    const line = this._bresenhamLine(Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2));

    let invalidCount = 0;
    for (const [x, y] of line) {
      const idx = y * this.width + x;
      const altitude = this.heightMap[idx];

      if (altitude <= SEA_LEVEL || altitude > 230) {
        invalidCount++;
      }
    }

    const invalidRatio = invalidCount / line.length;
    return invalidRatio < 0.10;
  }

  _ensureConnectivity(edges) {
    // Assurer que toutes les villes sont connectées
    // Utiliser Union-Find pour détecter les composantes

    const n = this.cities.length;
    const parent = Array.from({ length: n }, (_, i) => i);

    const find = (x) => {
      if (parent[x] !== x) {
        parent[x] = find(parent[x]);
      }
      return parent[x];
    };

    const union = (x, y) => {
      const px = find(x);
      const py = find(y);
      if (px !== py) {
        parent[px] = py;
        return true;
      }
      return false;
    };

    // Ajouter les arêtes existantes
    const edgeSet = new Set(edges.map(([i, j]) => {
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      return `${a},${b}`;
    }));

    for (const [i, j] of edges) {
      union(i, j);
    }

    // Trouver les composantes connexes
    const components = new Map();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!components.has(root)) {
        components.set(root, []);
      }
      components.get(root).push(i);
    }

    // Si plusieurs composantes, les connecter
    if (components.size > 1) {
      const compArray = Array.from(components.values());

      for (let c = 0; c < compArray.length - 1; c++) {
        let minDist = Infinity;
        let bestPair = null;

        // Trouver la connexion la plus courte entre composantes
        for (let i of compArray[c]) {
          for (let j of compArray[c + 1]) {
            const dist = this._distance(this.cities[i].position, this.cities[j].position);
            if (dist < minDist) {
              minDist = dist;
              bestPair = [i, j];
            }
          }
        }

        if (bestPair && this._checkEdgeValidity(this.cities[bestPair[0]].position, this.cities[bestPair[1]].position)) {
          edges.push(bestPair);
          edgeSet.add(`${Math.min(...bestPair)},${Math.max(...bestPair)}`);
          union(bestPair[0], bestPair[1]);
        }
      }
    }

    return edges;
  }

  _createRoutesFromEdges(edges) {
    let routeId = 0;

    for (const [cityIdxA, cityIdxB] of edges) {
      const cityA = this.cities[cityIdxA];
      const cityB = this.cities[cityIdxB];

      let path = this._generatePathPerlinDrift(
        cityA.position,
        cityB.position,
        this.stepSize
      );

      if (path && path.length > 0) {
        const route = new Route(
          routeId,
          cityA,
          cityB,
          path,
          Math.min(cityA.score, cityB.score)
        );
        this.routes.push(route);
        routeId++;
      }
    }
  }

  _generatePathPerlinDrift(start, goal, stepSize = 1.0) {
    const path = [start];
    let current = [start[0], start[1]];
    const goalPos = [goal[0], goal[1]];
    
    const maxSteps = Math.ceil(Math.sqrt(
      Math.pow(goal[0] - start[0], 2) + 
      Math.pow(goal[1] - start[1], 2)
    ) * 2);
    
    let steps = 0;

    while (steps < maxSteps) {
      steps++;
      
      const dx = goalPos[0] - current[0];
      const dy = goalPos[1] - current[1];
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 1.5) {
        break;
      }
      
      let dirX = dx / dist;
      let dirY = dy / dist;
      
      const px = Math.max(0, Math.min(this.width - 1, Math.round(current[0])));
      const py = Math.max(0, Math.min(this.height - 1, Math.round(current[1])));
      const perlinVal = this.perlinGrid[py][px];
      
      let perlinAngle = perlinVal * (Math.PI * 2 / 3);
      
      let cosA = Math.cos(perlinAngle);
      let sinA = Math.sin(perlinAngle);
      
      let rotatedX = dirX * cosA - dirY * sinA;
      let rotatedY = dirX * sinA + dirY * cosA;
      
      let nextPos = [
        current[0] + rotatedX * stepSize,
        current[1] + rotatedY * stepSize
      ];
      
      let nx = Math.round(nextPos[0]);
      let ny = Math.round(nextPos[1]);
      
      if (!(0 <= nx && nx < this.width && 0 <= ny && ny < this.height)) {
        break;
      }
      
      const idx = ny * this.width + nx;
      const altitude = this.heightMap[idx];
      
      if (altitude <= SEA_LEVEL || altitude > 200) {
        let found = false;
        const angleOffsets = [0.3, -0.3, 0.6, -0.6, 0.9, -0.9];
        
        for (const angleOffset of angleOffsets) {
          const testAngle = perlinAngle + angleOffset;
          const testCosA = Math.cos(testAngle);
          const testSinA = Math.sin(testAngle);
          
          const testDirX = dirX * testCosA - dirY * testSinA;
          const testDirY = dirX * testSinA + dirY * testCosA;
          
          const testPos = [
            current[0] + testDirX * stepSize,
            current[1] + testDirY * stepSize
          ];
          
          const tx = Math.round(testPos[0]);
          const ty = Math.round(testPos[1]);
          
          if (0 <= tx && tx < this.width && 0 <= ty && ty < this.height) {
            const testIdx = ty * this.width + tx;
            const testAltitude = this.heightMap[testIdx];
            
            if (testAltitude > SEA_LEVEL && testAltitude <= 200) {
              nextPos = testPos;
              found = true;
              break;
            }
          }
        }
        
        if (!found) {
          break;
        }
      }
      
      current = nextPos;
      path.push([Math.round(current[0]), Math.round(current[1])]);
    }
    
    path.push([Math.round(goal[0]), Math.round(goal[1])]);
    
    const filtered = [];
    for (const point of path) {
      if (filtered.length === 0 || 
          filtered[filtered.length - 1][0] !== point[0] || 
          filtered[filtered.length - 1][1] !== point[1]) {
        filtered.push(point);
      }
    }
    
    return filtered;
  }

  _bresenhamLine(x0, y0, x1, y1) {
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

  _distance(pos1, pos2) {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    return Math.sqrt(dx * dx + dy * dy);
  }

  _validateRoutes() {
    const validRoutes = [];

    for (const route of this.routes) {
      let waterPixels = 0;
      let mountainPixels = 0;

      for (const [x, y] of route.path) {
        const idx = y * this.width + x;
        const altitude = this.heightMap[idx];

        if (altitude <= SEA_LEVEL) {
          waterPixels++;
        }
        if (altitude > 230) {
          mountainPixels++;
        }
      }

      const waterRatio = waterPixels / route.path.length;
      const mountainRatio = mountainPixels / route.path.length;
      
      if (waterRatio < 0.01 && mountainRatio < 0.10) {
        validRoutes.push(route);
      }
    }

    this.routes = validRoutes;
  }
}

export class Route {
  constructor(id, cityA, cityB, path, importance) {
    this.id = id;
    this.cityA = cityA;
    this.cityB = cityB;
    this.path = path;
    this.importance = importance;
    this.length = path.length;
  }

  getWidth() {
    return 1;
  }

  getColor() {
    return '#6B4423';
  }
}
