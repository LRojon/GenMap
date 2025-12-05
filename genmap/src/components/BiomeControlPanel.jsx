import React from 'react';
import './BiomeControlPanel.css';

const BiomeControlPanel = ({ hoveredBiomeId = null }) => {
  const biomes = [
    { id: 0, name: 'Eau', color: 'rgb(30, 100, 200)' },
    { id: 1, name: 'Plage', color: 'rgb(238, 214, 175)' },
    { id: 2, name: 'Plaine', color: 'rgb(144, 238, 144)' },
    { id: 3, name: 'Forêt', color: 'rgb(34, 139, 34)' },
    { id: 4, name: 'Prairie', color: 'rgb(210, 180, 140)' },
    { id: 5, name: 'Désert', color: 'rgb(255, 215, 0)' },
    { id: 6, name: 'Collines', color: 'rgb(128, 128, 64)' },
    { id: 7, name: 'Montagne', color: 'rgb(169, 169, 169)' },
    { id: 8, name: 'Pics/Neige', color: 'rgb(255, 255, 255)' },
    { id: 9, name: 'Jungle', color: 'rgb(0, 100, 0)' },
    { id: 10, name: 'Marécage', color: 'rgb(144, 200, 160)' },
    { id: 11, name: 'Toundra', color: 'rgb(200, 220, 200)' },
  ];

  return (
    <div className="biome-panel">
      <div className="biome-section">
        <h3>Légende des biomes</h3>
        <div className="biome-legend">
          {biomes.map((biome) => (
            <div 
              key={biome.id} 
              className={`biome-item ${hoveredBiomeId === biome.id ? 'hovered' : ''}`}
            >
              <div
                className="biome-color"
                style={{ backgroundColor: biome.color }}
              />
              <span className="biome-name">{biome.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BiomeControlPanel;
