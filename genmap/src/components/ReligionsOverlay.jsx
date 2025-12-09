import React, { useEffect, useRef, useMemo } from 'react';

const ReligionsOverlay = ({ religions, voronoiRegionMap, voronoiPoints, config, activeTab, scale = 1, religionMap = null }) => {
  const canvasRef = useRef(null);

  // Mémoriser les couleurs des religions
  const religionColors = useMemo(() => {
    if (!religions || religions.length === 0) return new Map();
    
    const colors = new Map();
    religions.forEach((religion) => {
      colors.set(religion.id, religion.color);
    });
    return colors;
  }, [religions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !voronoiRegionMap || !voronoiPoints || !religions || religions.length === 0) {
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = config.width;
    canvas.height = config.height;

    // Si pas l'onglet religions, nettoyer le canvas et sortir
    if (activeTab !== 'religions') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Créer une ImageData pour les pixels
    const imageData = ctx.createImageData(config.width, config.height);
    const data = imageData.data;

    // Remplir avec les couleurs des religions basées sur religionMap (région -> religion)
    for (let i = 0; i < voronoiRegionMap.length; i++) {
      const regionIdx = voronoiRegionMap[i];
      
      // Si on a une religionMap, l'utiliser directement
      let religionId = -1;
      if (religionMap) {
        // religionMap est une Map, utiliser .get()
        if (typeof religionMap.get === 'function') {
          religionId = religionMap.get(regionIdx) || -1;
        } else if (religionMap[regionIdx] !== undefined) {
          // Sinon c'est un array/typed array
          religionId = religionMap[regionIdx];
        }
      }
      
      if (religionId >= 0) {
        const religion = religions.find(r => r.id === religionId);
        if (religion) {
          // Parser le format rgb(r, g, b)
          const rgbMatch = religion.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (rgbMatch) {
            const r = parseInt(rgbMatch[1], 10);
            const g = parseInt(rgbMatch[2], 10);
            const b = parseInt(rgbMatch[3], 10);
            
            data[i * 4 + 0] = r;
            data[i * 4 + 1] = g;
            data[i * 4 + 2] = b;
            data[i * 4 + 3] = 180; // Alpha = 180 (~70% opacité)
            continue;
          }
        }
      }
      
      // Zones sans religion - transparent
      data[i * 4 + 3] = 0; // Transparent
    }

    ctx.putImageData(imageData, 0, 0);

    // Dessiner les contours des régions religieuses
    // Parcourir tous les pixels et dessiner des lignes aux frontières
    
    for (let i = 0; i < voronoiRegionMap.length; i++) {
      const currentRegion = voronoiRegionMap[i];
      let currentReligionId = -1;
      
      if (religionMap) {
        if (typeof religionMap.get === 'function') {
          currentReligionId = religionMap.get(currentRegion) || -1;
        } else if (religionMap[currentRegion] !== undefined) {
          currentReligionId = religionMap[currentRegion];
        }
      }
      
      if (currentReligionId < 0) continue;
      
      const x = i % config.width;
      const y = Math.floor(i / config.width);
      
      // Vérifier les 4 voisins
      const directions = [
        { dx: 1, dy: 0 },  // droite
        { dx: -1, dy: 0 }, // gauche
        { dx: 0, dy: 1 },  // bas
        { dx: 0, dy: -1 }  // haut
      ];
      
      for (const dir of directions) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        
        if (nx < 0 || nx >= config.width || ny < 0 || ny >= config.height) continue;
        
        const neighborIdx = ny * config.width + nx;
        const neighborRegion = voronoiRegionMap[neighborIdx];
        let neighborReligionId = -1;
        
        if (religionMap) {
          if (typeof religionMap.get === 'function') {
            neighborReligionId = religionMap.get(neighborRegion) || -1;
          } else if (religionMap[neighborRegion] !== undefined) {
            neighborReligionId = religionMap[neighborRegion];
          }
        }
        
        // Si région différente ou pas de religion voisin, c'est une frontière
        if (neighborReligionId !== currentReligionId) {
          const religion = religions.find(r => r.id === currentReligionId);
          if (religion) {
            ctx.strokeStyle = religion.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 1;
            
            ctx.beginPath();
            if (dir.dx !== 0) {
              // Ligne verticale
              const lineX = dir.dx > 0 ? x + 1 : x;
              ctx.moveTo(lineX, y);
              ctx.lineTo(lineX, y + 1);
            } else {
              // Ligne horizontale
              const lineY = dir.dy > 0 ? y + 1 : y;
              ctx.moveTo(x, lineY);
              ctx.lineTo(x + 1, lineY);
            }
            ctx.stroke();
          }
        }
      }
    }


    for (let i = 0; i < voronoiRegionMap.length; i++) {
      const regionIdx = voronoiRegionMap[i];
      
      // Vérifier les voisins horizontaux et verticaux
      if (i > 0 && voronoiRegionMap[i - 1] !== regionIdx) {
        const x = i % config.width;
        const y = Math.floor(i / config.width);
        if (x > 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
        }
      }
      
      if (i + config.width < voronoiRegionMap.length && voronoiRegionMap[i + config.width] !== regionIdx) {
        const x = i % config.width;
        const y = Math.floor(i / config.width);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }
  }, [voronoiRegionMap, voronoiPoints, config, activeTab, religions, religionColors, religionMap]);

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas religions-overlay"
      style={{
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center',
        opacity: activeTab === 'religions' ? 0.7 : 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  );
};

export default ReligionsOverlay;
