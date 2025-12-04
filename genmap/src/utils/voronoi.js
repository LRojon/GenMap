/**
 * Implémentation simplifiée du diagramme de Voronoi
 */

export function generateVoronoi(width, height, seed = 0) {
  const random = seededRandom(seed);

  // Générer les points de Voronoi
  const numPoints = Math.max(10, Math.floor((width * height) / 15000));
  const points = [];

  for (let i = 0; i < numPoints; i++) {
    points.push({
      id: i,
      x: Math.floor(random() * width),
      y: Math.floor(random() * height),
    });
  }

  // Créer une carte de régions (très simple - closest point)
  const regionMap = new Uint32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let closestId = 0;
      let closestDist = Infinity;

      for (const point of points) {
        const dx = point.x - x;
        const dy = point.y - y;
        const dist = dx * dx + dy * dy; // Distance squared (plus rapide)

        if (dist < closestDist) {
          closestDist = dist;
          closestId = point.id;
        }
      }

      regionMap[y * width + x] = closestId;
    }
  }

  return {
    regions: points,
    regionMap,
  };
}

function seededRandom(seed) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}
