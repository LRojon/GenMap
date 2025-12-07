import React, { useEffect, useRef, useState } from 'react';
import './CountriesPanel.css';

const CountriesPanel = ({ countries, config, activeTab, scale = 1, onCountryHover }) => {
  const canvasRef = useRef(null);
  const countriesMapRef = useRef(null);
  const [hoveredCountryId, setHoveredCountryId] = useState(null);

  // Notifier le parent du pays survolé
  useEffect(() => {
    if (onCountryHover) {
      const country = hoveredCountryId !== null ? countries[hoveredCountryId] : null;
      onCountryHover(country);
    }
  }, [hoveredCountryId, countries, onCountryHover]);

  useEffect(() => {
    if (!canvasRef.current || !countries || countries.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = config.width;
    canvas.height = config.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pixelToCountry = new Uint32Array(config.width * config.height);
    pixelToCountry.fill(0xFFFFFFFF);

    for (let countryId = 0; countryId < countries.length; countryId++) {
      const country = countries[countryId];
      
      for (const pixelIdx of country.pixels) {
        pixelToCountry[pixelIdx] = countryId;
        
        const x = pixelIdx % config.width;
        const y = Math.floor(pixelIdx / config.width);
        
        ctx.fillStyle = country.color;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    ctx.globalAlpha = 1.0;

    countriesMapRef.current = pixelToCountry;

    // Dessiner les villes par-dessus les pays
    for (let countryId = 0; countryId < countries.length; countryId++) {
      const country = countries[countryId];
      
      for (const city of country.cities) {
        const [cx, cy] = city.position;
        
        // La capitale est plus grande
        const isCapital = city === country.capitalCity;
        const radius = isCapital ? 5 : 3;
        const opacity = isCapital ? 1.0 : 0.85;
        
        // Cercle blanc semi-transparent
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Bordure noire épaisse pour visibilité
        ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Ajouter un point central noir pour les capitales
        if (isCapital) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.beginPath();
          ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

  }, [countries, config, activeTab]);

  const handleClick = (e) => {
    if (!canvasRef.current || !countries || countries.length === 0) return;

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
        // Toggle: si on clique sur le même pays, le désélectionner
        setHoveredCountryId(countryId === hoveredCountryId ? null : countryId);
      } else {
        setHoveredCountryId(null);
      }
    }
  };

  const hoveredCountry = hoveredCountryId !== null ? countries[hoveredCountryId] : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="map-canvas countries-panel"
        onClick={handleClick}
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
    </>
  );
};

export default CountriesPanel;
