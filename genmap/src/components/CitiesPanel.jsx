import React, { useEffect, useRef, useState } from 'react';
import './CitiesPanel.css';

const CitiesPanel = ({ cities, config, activeTab, scale = 1 }) => {
  const canvasRef = useRef(null);
  const [hoveredCity, setHoveredCity] = useState(null);

  useEffect(() => {
    if (!canvasRef.current || !cities || !cities.cities || cities.cities.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = config.width;
    canvas.height = config.height;

    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // En mode generation, vérifier si les villes doivent être affichées
    if (activeTab === 'generation' && !config.showCities) {
      return;
    }

    // Calculer min/max score pour le mode cities
    const scores = cities.cities.map(c => c.score);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore || 1;

    // Dessiner les villes
    cities.cities.forEach((city, index) => {
      const [x, y] = city.position;

      let size = 2; // Taille par défaut
      let color = '#FF0000'; // Rouge par défaut

      if (activeTab === 'cities') {
        // Mode "cities": taille réduite proportionnelle au score
        const normalizedScore = (city.score - minScore) / scoreRange; // Entre 0 et 1
        size = 1 + normalizedScore * 6; // Entre 1 et 7 pixels (plus petit)
        color = '#FFD700'; // Or toujours
        
        // Au hover: vert un peu plus gros
        if (hoveredCity === index) {
          color = '#00FF00';
          size = 1 + normalizedScore * 6 + 2; // Un peu plus gros au hover
        }
      } else {
        // Mode "generation": un peu plus gros (3-4px), pas de hover
        size = 3.5;
        color = '#FF0000';
        
        // Debug: log les villes avec score très bas
        if (city.score < 30) {
          console.log(`⚠️ Low score city at (${x}, ${y}): score=${city.score}, altitude=${city.altitude}, biome=${city.biome}`);
        }
      }

      // Dessiner le cercle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Bordure (seulement en mode cities)
      if (activeTab === 'cities') {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = size > 3 ? 1.5 : 0.5;
        ctx.stroke();
      }
    });
  }, [cities, config, hoveredCity, activeTab]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !cities || !cities.cities) return;

    // En mode "generation", pas de hover
    if (activeTab === 'generation') {
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Calculer la position relative au canvas EN TENANT COMPTE DU SCALE
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Diviser par scale pour obtenir les coordonnées dans le canvas
    const x = mouseX / scale;
    const y = mouseY / scale;

    // Trouver la ville la plus proche
    let closestCity = null;
    let minDist = 15; // Rayon de détection

    cities.cities.forEach((city, index) => {
      const [cx, cy] = city.position;
      const dist = Math.hypot(cx - x, cy - y);
      
      if (dist < minDist) {
        minDist = dist;
        closestCity = index;
      }
    });

    setHoveredCity(closestCity);
  };

  const handleMouseLeave = () => {
    setHoveredCity(null);
  };

  // Récupérer les infos de la ville survolée
  const hoveredCityData = hoveredCity !== null ? cities.cities[hoveredCity] : null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="map-canvas cities-panel"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center',
          opacity: activeTab === 'generation' || activeTab === 'cities' ? 0.9 : 0,
          pointerEvents: activeTab === 'generation' || activeTab === 'cities' ? 'auto' : 'none',
          cursor: activeTab === 'cities' ? 'pointer' : 'default',
          zIndex: 3,
        }}
      />
      
      {/* Panneau d'info au hover en mode cities */}
      {activeTab === 'cities' && hoveredCityData && (
        <div className="city-info-panel">
          <div className="city-info-title">{hoveredCityData.name}</div>
          <div className="city-info-content">
            <div className="city-info-row">
              <span className="label">Score:</span>
              <span className="value">{Math.round(hoveredCityData.score)}</span>
            </div>
            <div className="city-info-row">
              <span className="label">Type:</span>
              <span className="value">{hoveredCityData.cityType}</span>
            </div>
            <div className="city-info-row">
              <span className="label">Population:</span>
              <span className="value">{Math.round(hoveredCityData.population).toLocaleString()}</span>
            </div>
            <div className="city-info-row">
              <span className="label">Position:</span>
              <span className="value">({hoveredCityData.position[0]}, {hoveredCityData.position[1]})</span>
            </div>
            <div className="city-info-row">
              <span className="label">Altitude:</span>
              <span className="value">{hoveredCityData.altitude}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CitiesPanel;
