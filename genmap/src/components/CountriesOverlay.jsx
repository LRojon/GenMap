import React, { useEffect, useRef, useState } from 'react';
import './CountriesOverlay.css';

const CountriesOverlay = ({ countries, config, activeTab, scale = 1 }) => {
  const canvasRef = useRef(null);
  const countriesMapRef = useRef(null);
  const [hoveredCountryId, setHoveredCountryId] = useState(null);

  useEffect(() => {
    if (!canvasRef.current || !countries || countries.length === 0) {
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

    // Dessiner les pays
    for (let countryId = 0; countryId < countries.length; countryId++) {
      const country = countries[countryId];
      const imageData = ctx.createImageData(config.width, config.height);
      const data = imageData.data;

      // Convertir color HSL à RGB
      const rgb = this._hslToRgb(country.color);

      // Dessiner les pixels du pays
      for (const pixelIdx of country.pixels) {
        pixelToCountry[pixelIdx] = countryId;
        const idx = pixelIdx * 4;
        data[idx] = rgb[0];
        data[idx + 1] = rgb[1];
        data[idx + 2] = rgb[2];
        data[idx + 3] = 150; // Semi-transparent
      }

      ctx.putImageData(imageData, 0, 0);
    }

    // Stocker la map pour détection
    countriesMapRef.current = pixelToCountry;

    console.log(`🎨 Countries overlay rendered: ${countries.length} countries`);
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
        opacity: activeTab === 'countries' ? 0.7 : 0,
        pointerEvents: activeTab === 'countries' ? 'auto' : 'none',
        cursor: 'pointer',
        zIndex: 2,
      }}
    />
  );
};

export default CountriesOverlay;
