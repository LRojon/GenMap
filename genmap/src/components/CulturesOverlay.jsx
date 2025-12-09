import React, { useEffect, useRef } from 'react';

const CulturesOverlay = ({ cultures, config, activeTab, cultureMap = null }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cultures || cultures.length === 0 || !cultureMap) {
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = config.width;
    canvas.height = config.height;

    // Si pas l'onglet cultures, nettoyer le canvas et sortir
    if (activeTab !== 'cultures') {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Créer une ImageData pour les pixels
    const imageData = ctx.createImageData(config.width, config.height);
    const data = imageData.data;

    // Remplir avec les couleurs des cultures basées sur cultureMap (pixel -> culture_id)
    for (let i = 0; i < cultureMap.length; i++) {
      const cultureId = cultureMap[i];
      
      // Si pas de culture assignée, pixel transparent
      if (cultureId === 255) {
        data[i * 4 + 3] = 0; // Transparent
        continue;
      }
      
      // Trouver la culture
      const culture = cultures.find(c => c.id === cultureId);
      if (culture) {
        // Parser le format rgb(r, g, b)
        const rgbMatch = culture.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const r = parseInt(rgbMatch[1], 10);
          const g = parseInt(rgbMatch[2], 10);
          const b = parseInt(rgbMatch[3], 10);
          
          data[i * 4 + 0] = r;
          data[i * 4 + 1] = g;
          data[i * 4 + 2] = b;
          data[i * 4 + 3] = 180; // Alpha = 180 (~70% opacité)
        }
      } else {
        data[i * 4 + 3] = 0; // Transparent si culture non trouvée
      }
    }

    ctx.putImageData(imageData, 0, 0);

  }, [config, cultures, cultureMap, activeTab]);

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas cultures-overlay"
      style={{
        transform: `translate(-50%, -50%) scale(${config.scale})`,
        transformOrigin: 'center',
        opacity: activeTab === 'cultures' ? 0.7 : 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  );
};

export default CulturesOverlay;
