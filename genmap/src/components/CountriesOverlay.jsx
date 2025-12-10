import React, { useEffect, useRef, useState } from 'react';
import './CountriesOverlay.css';

const CountriesOverlay = ({ countries, config, activeTab, scale = 1 }) => {
  const canvasRef = useRef(null);
  const countriesMapRef = useRef(null);
  // eslint-disable-next-line no-unused-vars
  const [hoveredCountryId, setHoveredCountryId] = useState(null);

  useEffect(() => {
    console.log('CountriesOverlay useEffect triggered, activeTab:', activeTab, 'countries.length:', countries?.length);
    
    if (!canvasRef.current || !countries || countries.length === 0) {
      console.log('Early return: canvas or countries missing');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = config.width;
    canvas.height = config.height;

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Créer une map pour quick lookup
    const pixelToCountry = new Uint32Array(config.width * config.height);
    pixelToCountry.fill(0xFFFFFFFF); // -1 en unsigned

    // Créer une seule imageData pour tous les pixels
    const imageData = ctx.createImageData(config.width, config.height);
    const data = imageData.data;

    // Remplir d'abord les pixels des pays
    for (let countryId = 0; countryId < countries.length; countryId++) {
      const country = countries[countryId];

      // Convertir color HSL à RGB
      const rgb = this._hslToRgb(country.color);

      // Dessiner les pixels du pays
      for (const pixelIdx of country.pixels) {
        pixelToCountry[pixelIdx] = countryId;
        const idx = pixelIdx * 4;
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = 255; // Opaque
      }
    }

    // Stocker la map pour détection
    countriesMapRef.current = pixelToCountry;

    // Première passe: identifier les pixels de bordure
    const borderPixels = new Set();
    
    for (let y = 0; y < config.height; y++) {
      for (let x = 0; x < config.width; x++) {
        const pixelIdx = y * config.width + x;
        const currentCountry = pixelToCountry[pixelIdx];

        // Ignorer les pixels non assignés (eau)
        if (currentCountry === 0xFFFFFFFF) continue;

        // Vérifier les 8 voisins (toutes les directions)
        const neighbors = [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
          [x + 1, y + 1],
          [x - 1, y - 1],
          [x + 1, y - 1],
          [x - 1, y + 1],
        ];

        let isBorder = false;
        for (const [nx, ny] of neighbors) {
          // Ignorer les limites de map
          if (nx < 0 || nx >= config.width || ny < 0 || ny >= config.height) {
            continue;
          }
          
          const neighborIdx = ny * config.width + nx;
          const neighborCountry = pixelToCountry[neighborIdx];

          // Si le voisin appartient à un pays DIFFÉRENT (et n'est pas de l'eau), c'est une frontière
          if (neighborCountry !== currentCountry && neighborCountry !== 0xFFFFFFFF) {
            isBorder = true;
            break;
          }
        }

        if (isBorder) {
          borderPixels.add(pixelIdx);
        }
      }
    }

    console.log('DEBUG: borderPixels size:', borderPixels.size);

    // Deuxième passe: épaissir les frontières (3-4px pour meilleure lisibilité)
    const thickBorders = new Set(borderPixels);
    for (const borderPixelIdx of borderPixels) {
      const x = borderPixelIdx % config.width;
      const y = Math.floor(borderPixelIdx / config.width);

      // Ajouter les voisins immédiats + diagonales (épaisseur ~3-4px)
      const thickNeighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
        [x + 1, y + 1],
        [x - 1, y - 1],
        [x + 1, y - 1],
        [x - 1, y + 1],
        [x + 2, y],    // Épaisseur supplémentaire
        [x - 2, y],
        [x, y + 2],
        [x, y - 2],
      ];

      for (const [nx, ny] of thickNeighbors) {
        if (nx >= 0 && nx < config.width && ny >= 0 && ny < config.height) {
          thickBorders.add(ny * config.width + nx);
        }
      }
    }

    // Troisième passe: dessiner les frontières épaissies avec couleur NOIRE OPAQUE pour visibilité
    for (const borderPixelIdx of thickBorders) {
      const currentCountry = pixelToCountry[borderPixelIdx];
      
      // Ne pas peindre sur de l'eau
      if (currentCountry === 0xFFFFFFFF) continue;

      // Utiliser NOIR pour les frontières (très visible)
      const idx = borderPixelIdx * 4;
      data[idx] = 0;        // R - noir
      data[idx + 1] = 0;    // G - noir
      data[idx + 2] = 0;    // B - noir
      data[idx + 3] = 255;  // Opacité complète
    }

    // Dessiner tout d'un coup
    ctx.putImageData(imageData, 0, 0);

    // Quatrième passe: redessiner les frontières PAR-DESSUS avec couleur BLANCHE pour DEBUG
    // Créer une nouvelle couche pour les frontières
    const borderImageData = ctx.createImageData(config.width, config.height);
    const borderData = borderImageData.data;
    borderData.fill(0); // Remplir de transparent

    let borderPixelCount = 0;
    for (const borderPixelIdx of thickBorders) {
      const currentCountry = pixelToCountry[borderPixelIdx];
      
      // Ne pas peindre sur de l'eau
      if (currentCountry === 0xFFFFFFFF) continue;

      borderPixelCount++;
      // BLANC BRILLANT pour bien voir les frontières
      const idx = borderPixelIdx * 4;
      borderData[idx] = 255;      // R - blanc
      borderData[idx + 1] = 255;  // G - blanc
      borderData[idx + 2] = 255;  // B - blanc
      borderData[idx + 3] = 255;  // Opacité complète
    }

    console.log('DEBUG: thickBorders size:', thickBorders.size, 'pixels dessinés:', borderPixelCount);
    
    // Dessiner la couche de frontières par-dessus
    ctx.putImageData(borderImageData, 0, 0);

    // Dessiner les villes par-dessus
    for (let countryId = 0; countryId < countries.length; countryId++) {
      const country = countries[countryId];
      
      // Dessiner les villes du pays
      for (const city of country.cities) {
        const [cx, cy] = city.position;
        
        // La capitale est plus grande et distinctive
        const isCapital = city === country.capitalCity;
        
        if (isCapital) {
          // CAPITALE: Cercle doré avec halo
          // Halo doré (arrière-plan)
          ctx.fillStyle = 'rgba(255, 165, 0, 0.3)';
          ctx.beginPath();
          ctx.arc(cx, cy, 10, 0, Math.PI * 2);
          ctx.fill();
          
          // Cercle doré principal
          ctx.fillStyle = 'rgba(255, 215, 0, 1.0)';
          ctx.beginPath();
          ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          ctx.fill();
          
          // Bordure noire épaisse
          ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Point central noir
          ctx.fillStyle = 'rgba(0, 0, 0, 1)';
          ctx.beginPath();
          ctx.arc(cx, cy, 2, 0, Math.PI * 2);
          ctx.fill();
          
          // Couronne au-dessus (emoji-like)
          ctx.fillStyle = 'rgba(255, 215, 0, 1.0)';
          ctx.font = 'bold 10px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('👑', cx, cy - 10);
        } else {
          // VILLE NORMALE: Cercle blanc petit
          const radius = 4;
          const opacity = 0.85;
          
          // Cercle blanc
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          
          // Bordure noire fine
          ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }


  }, [countries, config, activeTab]);

  const _hslToRgb = (hslString) => {
    // Parse HSL string: "hsl(h, s%, l%)"
    const match = hslString.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!match) return [100, 100, 100];

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

    return [
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255),
    ];
  };

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !countries || countries.length === 0) return;

    // En mode countries: activer le hover
    if (activeTab !== 'countries') {
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const x = Math.floor(mouseX / scale);
    const y = Math.floor(mouseY / scale);

    if (x >= 0 && x < config.width && y >= 0 && y < config.height) {
      const pixelIdx = y * config.width + x;
      const countryId = countriesMapRef.current[pixelIdx];

      if (countryId !== 0xFFFFFFFF && countryId < countries.length) {
        setHoveredCountryId(countryId);
      } else {
        setHoveredCountryId(null);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoveredCountryId(null);
  };

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas countries-overlay"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center',
        opacity: activeTab === 'countries' ? 1.0 : 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  );
};

export default CountriesOverlay;
