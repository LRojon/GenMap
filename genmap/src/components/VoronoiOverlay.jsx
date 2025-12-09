import React, { useEffect, useRef, useMemo } from 'react';

const VoronoiOverlay = ({ voronoiRegionMap, voronoiPoints, config, scale = 1, showRegions = false }) => {
  const canvasRef = useRef(null);

  // Mémoriser les couleurs pour éviter de les recalculer
  const regionColors = useMemo(() => {
    if (!voronoiPoints) return new Map();
    
    const colors = new Map();
    const hueOffset = (voronoiPoints.length * 42) % 360; // Déterministe basé sur le nombre de points

    for (let i = 0; i < voronoiPoints.length; i++) {
      const hue = (hueOffset + (i * 137.5) % 360) % 360;
      const saturation = 70 + ((i * 12345) % 20);
      const lightness = 50 + ((i * 54321) % 15);
      colors.set(i, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
  }, [voronoiPoints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !voronoiRegionMap || !voronoiPoints) {
      return;
    }

    const ctx = canvas.getContext('2d');

    canvas.width = config.width;
    canvas.height = config.height;

    // Si pas visible, nettoyer le canvas et sortir
    if (!showRegions) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Créer une ImageData pour les pixels
    const imageData = ctx.createImageData(config.width, config.height);
    const data = imageData.data;

    // Remplir avec les couleurs des régions
    for (let i = 0; i < voronoiRegionMap.length; i++) {
      const regionIdx = voronoiRegionMap[i];
      const color = regionColors.get(regionIdx);
      
      if (color) {
        const rgb = hexToRgb(hslToHex(color));
        if (rgb) {
          const idx = i * 4;
          data[idx] = rgb[0];
          data[idx + 1] = rgb[1];
          data[idx + 2] = rgb[2];
          data[idx + 3] = 150; // Semi-transparent
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Dessiner les points Voronoi
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;

    for (const [x, y] of voronoiPoints) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Dessiner les frontières des régions avec du noir
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.8;

    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        const pixelIdx = y * config.width + x;
        const currentRegion = voronoiRegionMap[pixelIdx];

        // Vérifier les voisins
        const neighbors = [
          [x + 1, y],
          [x, y + 1],
        ];

        for (const [nx, ny] of neighbors) {
          if (nx >= config.width || ny >= config.height) continue;

          const neighborIdx = ny * config.width + nx;
          const neighborRegion = voronoiRegionMap[neighborIdx];

          // Si c'est une bordure de région, dessiner une ligne
          if (neighborRegion !== currentRegion) {
            if (nx < config.width) {
              ctx.fillStyle = '#000000';
              ctx.fillRect(x, y, 1, 1);
            }
          }
        }
      }
    }

    ctx.globalAlpha = 1.0;

  }, [voronoiRegionMap, voronoiPoints, config, showRegions, regionColors]);

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas voronoi-overlay"
      style={{
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center',
        opacity: showRegions ? 0.6 : 0,
        pointerEvents: showRegions ? 'auto' : 'none',
      }}
    />
  );
};

// Utilitaires de conversion de couleur
function hslToHex(hslString) {
  const match = hslString.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#ffffff';

  let h = parseInt(match[1]) / 360;
  let s = parseInt(match[2]) / 100;
  let l = parseInt(match[3]) / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null;
}

export default VoronoiOverlay;
