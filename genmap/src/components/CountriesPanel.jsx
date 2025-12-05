import React, { useEffect, useRef, useState } from 'react';
import './CountriesPanel.css';

const CountriesPanel = ({ countries, config, activeTab, scale = 1 }) => {
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

    console.log(`🎨 Countries panel rendered: ${countries.length} countries`);
  }, [countries, config, activeTab]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !countries || countries.length === 0) return;

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

  const hoveredCountry = hoveredCountryId !== null ? countries[hoveredCountryId] : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="map-canvas countries-panel"
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

      {activeTab === 'countries' && hoveredCountry && (
        <div className="country-info-panel">
          <div
            className="country-info-header"
            style={{ backgroundColor: hoveredCountry.color }}
          >
            {hoveredCountry.name}
          </div>
          <div className="country-info-content">
            <div className="country-info-row">
              <span className="label">Capital:</span>
              <span className="value">{hoveredCountry.capitalCity.name}</span>
            </div>
            <div className="country-info-row">
              <span className="label">Population:</span>
              <span className="value">{Math.round(hoveredCountry.population).toLocaleString()}</span>
            </div>
            <div className="country-info-row">
              <span className="label">Area:</span>
              <span className="value">{hoveredCountry.area.toLocaleString()} px²</span>
            </div>
            <div className="country-info-row">
              <span className="label">Cities:</span>
              <span className="value">{hoveredCountry.cities.length}</span>
            </div>
            <div className="country-info-row">
              <span className="label">Main Biome:</span>
              <span className="value">Biome #{hoveredCountry.mainBiome}</span>
            </div>
            <div className="country-info-row">
              <span className="label">Climate:</span>
              <span className="value">{hoveredCountry.mainClimate}</span>
            </div>
            {hoveredCountry.cities.length > 0 && (
              <div className="country-cities-list">
                <div className="cities-title">Cities:</div>
                {hoveredCountry.cities.map((city, idx) => (
                  <div key={idx} className="city-item">
                    {city.name} {hoveredCountry.capitalCity === city ? '👑' : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default CountriesPanel;
