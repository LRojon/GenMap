import React, { useState } from 'react';
import './AdvancedSettings.css';

const AdvancedSettings = ({ config, onConfigChange, onClose }) => {
  const [perlinSettings, setPerlinSettings] = useState({
    scale: 50,
    octaves: 8,
    persistence: 0.5,
    lacunarity: 2.0,
  });

  const [biomeThresholds, setBiomeThresholds] = useState({
    water: 85,
    beach: 100,
    plain: 140,
    grassland: 160,
    hills: 180,
    mountain: 210,
    snow: 255,
  });

  const handlePerlinChange = (key, value) => {
    setPerlinSettings({ ...perlinSettings, [key]: value });
  };

  const handleBiomeChange = (key, value) => {
    setBiomeThresholds({ ...biomeThresholds, [key]: value });
  };

  const handleApply = () => {
    // Les modifications seraient appliquées au contexte de configuration
    console.log('Perlin:', perlinSettings);
    console.log('Biomes:', biomeThresholds);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Advanced Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="settings-section">
            <h3>Perlin Noise Configuration</h3>
            
            <div className="setting-item">
              <label>
                Scale: <span>{perlinSettings.scale}</span>
              </label>
              <input
                type="range"
                min="10"
                max="200"
                value={perlinSettings.scale}
                onChange={(e) => handlePerlinChange('scale', parseInt(e.target.value))}
                className="slider"
              />
              <small>Taille des features générées</small>
            </div>

            <div className="setting-item">
              <label>
                Octaves: <span>{perlinSettings.octaves}</span>
              </label>
              <input
                type="range"
                min="1"
                max="16"
                value={perlinSettings.octaves}
                onChange={(e) => handlePerlinChange('octaves', parseInt(e.target.value))}
                className="slider"
              />
              <small>Nombre de couches de détail</small>
            </div>

            <div className="setting-item">
              <label>
                Persistence: <span>{perlinSettings.persistence.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={perlinSettings.persistence}
                onChange={(e) => handlePerlinChange('persistence', parseFloat(e.target.value))}
                className="slider"
              />
              <small>Amplitude relative de chaque octave</small>
            </div>

            <div className="setting-item">
              <label>
                Lacunarity: <span>{perlinSettings.lacunarity.toFixed(2)}</span>
              </label>
              <input
                type="range"
                min="1"
                max="4"
                step="0.1"
                value={perlinSettings.lacunarity}
                onChange={(e) => handlePerlinChange('lacunarity', parseFloat(e.target.value))}
                className="slider"
              />
              <small>Fréquence relative de chaque octave</small>
            </div>
          </div>

          <div className="settings-section">
            <h3>Biome Thresholds</h3>
            
            <div className="threshold-grid">
              {Object.entries(biomeThresholds).map(([key, value]) => (
                <div key={key} className="threshold-item">
                  <label>{key.toUpperCase()}</label>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={value}
                    onChange={(e) => handleBiomeChange(key, parseInt(e.target.value))}
                    className="threshold-input"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="button button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" onClick={handleApply}>
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettings;
