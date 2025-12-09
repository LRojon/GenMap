import React, { useEffect, useRef, useState } from 'react';

const CitiesOverlay = ({ cities, config, activeTab, scale = 1 }) => {
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

    // Afficher les villes sur tous les onglets sauf 'cities'
    if (activeTab === 'cities') {
      return;
    }

    // Dessiner les villes
    cities.cities.forEach((city, index) => {
      const [x, y] = city.position;

      // Déterminer la taille basée sur la population/type
      let size = 3;
      if (city.cityType === 'metropolis') {
        size = 8;
      } else if (city.cityType === 'city') {
        size = 6;
      } else if (city.cityType === 'town') {
        size = 5;
      } else {
        size = 3;
      }

      // Couleur: jaune/or pour les villes
      ctx.fillStyle = hoveredCity === index ? '#00FF00' : '#FFD700';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Bordure blanche
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Afficher le nom et score au survol
      if (hoveredCity === index) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${city.name} (${Math.round(city.score)})`, x, y - size - 10);
      }
    });
  }, [cities, config, hoveredCity, activeTab]);

  const handleMouseMove = (e) => {
    if (!canvasRef.current || !cities || !cities.cities) return;

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

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas cities-overlay"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center',
        opacity: activeTab === 'cities' ? 0 : 0.9,
        pointerEvents: activeTab === 'countries' ? 'auto' : 'none',
        cursor: activeTab === 'countries' ? 'pointer' : 'default',
        zIndex: 3,
      }}
    />
  );
};

export default CitiesOverlay;
