import React, { useState } from 'react';
import './ClimateControlPanel.css';

const ClimateControlPanel = ({ onOpacityChange }) => {
  const [opacity, setOpacity] = useState(70);

  const handleOpacityChange = (e) => {
    const newOpacity = parseInt(e.target.value);
    setOpacity(newOpacity);
    onOpacityChange(newOpacity);
  };

  const handleInputChange = (e) => {
    const value = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
    setOpacity(value);
    onOpacityChange(value);
  };

  const climateZones = [
    { range: '0-85', name: 'Polaire/Glacial', color: 'rgb(100, 150, 255)' },
    { range: '85-127', name: 'Tempéré Froid', color: 'rgb(100, 200, 255)' },
    { range: '127-170', name: 'Tempéré Chaud', color: 'rgb(100, 255, 100)' },
    { range: '170-210', name: 'Tropical', color: 'rgb(255, 150, 100)' },
    { range: '210-255', name: 'Désertique', color: 'rgb(255, 100, 100)' },
  ];

  return (
    <div className="climate-panel">
      <div className="climate-section">
        <h3>Opacité du climat</h3>
        <div className="opacity-control">
          <input
            type="range"
            min="0"
            max="100"
            value={opacity}
            onChange={handleOpacityChange}
            className="opacity-slider"
          />
          <input
            type="number"
            min="0"
            max="100"
            value={opacity}
            onChange={handleInputChange}
            className="opacity-input"
          />
          <span className="opacity-percent">%</span>
        </div>
      </div>

      <div className="climate-section">
        <h3>Légende des climats</h3>
        <div className="legend">
          {climateZones.map((zone, index) => (
            <div key={index} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: zone.color }}
              />
              <div className="legend-text">
                <span className="legend-range">{zone.range}</span>
                <span className="legend-name">{zone.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ClimateControlPanel;
