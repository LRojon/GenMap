import React, { useState } from 'react';
import './ControlPanel.css';

const ControlPanel = ({ config, onConfigChange, isGenerating }) => {
  const [localConfig, setLocalConfig] = useState(config);

  const handleChange = (key, value) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
  };

  const handleGenerate = () => {
    onConfigChange(localConfig);
  };

  const handleRandomSeed = () => {
    const newSeed = Math.floor(Math.random() * 10000000000); // 10 chiffres max
    handleChange('seed', newSeed);
    onConfigChange({ ...localConfig, seed: newSeed });
  };

  return (
    <div className="control-panel glass-card">
      <h1 className="panel-title">GenMap</h1>

      <div className="panel-section">
        <h2>Map Settings</h2>
        
        <div className="control-group">
          <label>Width:</label>
          <div className="dimension-controls">
            <input
              type="range"
              min="200"
              max="2000"
              step="100"
              value={localConfig.width}
              onChange={(e) => handleChange('width', parseInt(e.target.value))}
              disabled={isGenerating}
              className="slider"
            />
            <input
              type="number"
              min="200"
              max="2000"
              step="100"
              value={localConfig.width}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 200 && val <= 2000) {
                  handleChange('width', val);
                }
              }}
              disabled={isGenerating}
              className="dimension-input"
            />
          </div>
        </div>

        <div className="control-group">
          <label>Height:</label>
          <div className="dimension-controls">
            <input
              type="range"
              min="200"
              max="2000"
              step="100"
              value={localConfig.height}
              onChange={(e) => handleChange('height', parseInt(e.target.value))}
              disabled={isGenerating}
              className="slider"
            />
            <input
              type="number"
              min="200"
              max="2000"
              step="100"
              value={localConfig.height}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 200 && val <= 2000) {
                  handleChange('height', val);
                }
              }}
              disabled={isGenerating}
              className="dimension-input"
            />
          </div>
        </div>

        <div className="control-group">
          <label>
            Seed: <span className="seed-value">{localConfig.seed}</span>
          </label>
          <div className="seed-controls">
            <input
              type="number"
              min="0"
              max="9999999999"
              value={localConfig.seed}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                if (val >= 0 && val <= 9999999999) {
                  handleChange('seed', val);
                }
              }}
              disabled={isGenerating}
              className="seed-input"
            />
            <button 
              onClick={handleRandomSeed}
              disabled={isGenerating}
              className="button button-secondary"
            >
              🎲 Random
            </button>
          </div>
        </div>

        <div className="control-group">
          <label>
            Zoom: <span className="value">{(localConfig.scale * 100).toFixed(0)}%</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={localConfig.scale}
            onChange={(e) => handleChange('scale', parseFloat(e.target.value))}
            className="slider"
          />
        </div>
      </div>

      <div className="panel-section">
        <h2>Display Options</h2>
        
        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localConfig.showBiomes}
              onChange={(e) => handleChange('showBiomes', e.target.checked)}
              disabled={isGenerating}
            />
            <span>Show Biomes</span>
          </label>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localConfig.showCities}
              onChange={(e) => handleChange('showCities', e.target.checked)}
              disabled={isGenerating}
            />
            <span>Show Cities</span>
          </label>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localConfig.showRivers}
              onChange={(e) => handleChange('showRivers', e.target.checked)}
              disabled={isGenerating}
            />
            <span>Show Rivers</span>
          </label>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localConfig.showRoutes}
              onChange={(e) => handleChange('showRoutes', e.target.checked)}
              disabled={isGenerating}
            />
            <span>Show Routes</span>
          </label>
        </div>

        <div className="checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={localConfig.showRegions}
              onChange={(e) => handleChange('showRegions', e.target.checked)}
              disabled={isGenerating}
            />
            <span>Show Regions</span>
          </label>
        </div>
      </div>

      <div className="panel-actions">
        <button 
          onClick={handleGenerate}
          disabled={isGenerating}
          className="button button-primary"
        >
          {isGenerating ? '⏳ Generating...' : '🗺️ Generate Map'}
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
