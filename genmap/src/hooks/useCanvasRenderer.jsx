import { useCallback } from 'react';

export function useCanvasRenderer() {
  const renderBiomes = useCallback((ctx, biomes, width, height, biomeColors) => {
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    for (let i = 0; i < width * height; i++) {
      const biomeId = biomes[i];
      const color = biomeColors[biomeId] || [100, 100, 100];
      const idx = i * 4;
      data[idx] = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  const drawCities = useCallback((ctx, cities, width, height) => {
    if (!cities || cities.length === 0) return;

    ctx.fillStyle = 'rgba(255, 200, 0, 0.8)';
    ctx.strokeStyle = 'rgba(255, 200, 0, 1)';
    ctx.lineWidth = 2;

    for (const city of cities) {
      const x = (city.x / 100) * width;
      const y = (city.y / 100) * height;
      
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Dessiner le nom
      ctx.fillStyle = 'rgba(255, 200, 0, 1)';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(city.name, x + 10, y - 5);
    }
  }, []);

  const drawRivers = useCallback((ctx, rivers, width, height) => {
    if (!rivers || rivers.length === 0) return;

    ctx.strokeStyle = 'rgba(100, 150, 255, 0.7)';
    ctx.lineWidth = 2;

    for (const river of rivers) {
      ctx.beginPath();
      for (let i = 0; i < river.path.length; i++) {
        const point = river.path[i];
        const x = (point.x / 100) * width;
        const y = (point.y / 100) * height;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }, []);

  const drawRoutes = useCallback((ctx, routes, width, height) => {
    if (!routes || routes.length === 0) return;

    ctx.strokeStyle = 'rgba(200, 150, 100, 0.6)';
    ctx.lineWidth = 3;
    ctx.lineDashPattern = [5, 5];

    for (const route of routes) {
      ctx.beginPath();
      for (let i = 0; i < route.path.length; i++) {
        const point = route.path[i];
        const x = (point.x / 100) * width;
        const y = (point.y / 100) * height;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }, []);

  const drawRegionBorders = useCallback((ctx, regionMap, width, height) => {
    ctx.strokeStyle = 'rgba(200, 100, 100, 0.3)';
    ctx.lineWidth = 1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const currentRegion = regionMap[idx];

        // Vérifier les voisins
        if (x + 1 < width && regionMap[idx + 1] !== currentRegion) {
          ctx.strokeStyle = 'rgba(200, 100, 100, 0.3)';
          ctx.beginPath();
          ctx.moveTo(x + 1, y);
          ctx.lineTo(x + 1, y + 1);
          ctx.stroke();
        }

        if (y + 1 < height && regionMap[idx + width] !== currentRegion) {
          ctx.strokeStyle = 'rgba(200, 100, 100, 0.3)';
          ctx.beginPath();
          ctx.moveTo(x, y + 1);
          ctx.lineTo(x + 1, y + 1);
          ctx.stroke();
        }
      }
    }
  }, []);

  return {
    renderBiomes,
    drawCities,
    drawRivers,
    drawRoutes,
    drawRegionBorders,
  };
}
