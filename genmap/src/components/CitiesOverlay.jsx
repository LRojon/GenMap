import React, { useEffect, useRef, useState } from 'react';

const CitiesOverlay = ({ cities, config, activeTab, scale = 1, countries = null }) => {
  const canvasRef = useRef(null);
  const [hoveredCity, setHoveredCity] = useState(null);

  // Créer une map des capitales pour vérification rapide
  const capitalPositions = React.useMemo(() => {
    if (!countries || !countries.countries) return new Set();
    return new Set(countries.countries.map(c => `${c.capitalCity.position[0]},${c.capitalCity.position[1]}`));
  }, [countries]);

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

    // Afficher les villes sur tous les onglets sauf 'countries'
    // (sur countries, les villes sont affichées par CountriesOverlay)
    if (activeTab === 'countries') {
      return;
    }

    // Dessiner les villes
    cities.cities.forEach((city, index) => {
      const [x, y] = city.position;
      const isCapital = capitalPositions.has(`${x},${y}`);

      // Déterminer la taille basée sur la population/type
      let size = 3;
      if (city.cityType === 'metropolis') {
        size = isCapital ? 10 : 8;
      } else if (city.cityType === 'city') {
        size = isCapital ? 8 : 6;
      } else if (city.cityType === 'town') {
        size = isCapital ? 7 : 5;
      } else {
        size = isCapital ? 5 : 3;
      }

      // Couleur: or pour les capitales, jaune pour les villes
      if (isCapital) {
        ctx.fillStyle = hoveredCity === index ? '#00FF00' : '#FFD700';
        // Ajouter un halo doré autour des capitales
        ctx.fillStyle = '#FFA500';
        ctx.beginPath();
        ctx.arc(x, y, size + 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.fillStyle = hoveredCity === index ? '#00FF00' : (isCapital ? '#FFD700' : '#FFD700');
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();

      // Bordure plus épaisse pour les capitales
      ctx.strokeStyle = isCapital ? '#FFFFFF' : '#FFFFFF';
      ctx.lineWidth = isCapital ? 2 : 1;
      ctx.stroke();

      // Afficher une couronne pour les capitales
      if (isCapital) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('👑', x, y - size - 12);
      }

      // Afficher le nom et score au survol
      if (hoveredCity === index) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${city.name} ${isCapital ? '(Capital)' : ''} (${Math.round(city.score)})`, x, y - size - 10);
      }
    });
  }, [cities, config, hoveredCity, activeTab, capitalPositions]);

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
    
    // Si on n'est pas sur une ville, passer l'événement au-dessous
    if (closestCity === null && canvasRef.current) {
      // Laisser le événement bubbler vers les éléments en-dessous
      e.stopPropagation = () => {}; // Ne pas bloquer
    }
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
        opacity: activeTab === 'countries' ? 0 : 0.9,
        pointerEvents: activeTab === 'countries' ? 'none' : 'auto',
        cursor: activeTab === 'cities' ? 'pointer' : 'default',
        zIndex: 3,
      }}
    />
  );
};

export default CitiesOverlay;
