import React, { useState, useCallback } from 'react';
import './App.css';
import MapCanvas from './components/MapCanvas';
import ControlPanel from './components/ControlPanel';
import ClimateControlPanel from './components/ClimateControlPanel';

function getInitialMapConfig() {
  return {
    width: 1024,
    height: 768,
    seed: Math.floor(Math.random() * 10000000000), // 10 chiffres max
    scale: 1,
    showCities: true,
    showRivers: true,
    showRoutes: true,
    showBiomes: true,
    showClimate: true,
    showRegions: false,
  };
}

function App() {
  const [activeTab, setActiveTab] = useState('generation');
  const [mapConfig, setMapConfig] = useState(getInitialMapConfig());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationTimeoutId, setGenerationTimeoutId] = useState(null);
  const [climateOpacity, setClimateOpacity] = useState(70);

  const tabs = [
    { id: 'generation', name: 'Generation', icon: '⚡' },
    { id: 'map', name: 'Map', icon: '🗺' },
    { id: 'countries', name: 'Countries', icon: '🏛' },
    { id: 'cities', name: 'Cities', icon: '🏙' },
    { id: 'routes', name: 'Routes', icon: '🛣' },
    { id: 'biomes', name: 'Biomes', icon: '🌿' },
    { id: 'climate', name: 'Climate', icon: '🌡' },
    { id: 'religions', name: 'Religions', icon: '⛪' },
    { id: 'cultures', name: 'Cultures', icon: '🎭' },
  ];

  const handleGenerateMap = useCallback((config) => {
    // Annuler les timeouts précédents
    if (generationTimeoutId) {
      clearTimeout(generationTimeoutId);
    }

    setIsGenerating(true);
    setMapConfig(config);

    // Débloquer automatiquement après 60 secondes si la génération prend trop longtemps
    const timeoutId = setTimeout(() => {
      console.warn('Map generation timeout - resetting state');
      setIsGenerating(false);
      setGenerationTimeoutId(null);
    }, 60000);

    setGenerationTimeoutId(timeoutId);
  }, [generationTimeoutId]);

  const handleMapGenerated = useCallback((data) => {
    // Carte générée, données disponibles dans 'data'
    console.log('Map generated:', data);
    
    // Annuler le timeout
    if (generationTimeoutId) {
      clearTimeout(generationTimeoutId);
      setGenerationTimeoutId(null);
    }
    
    setIsGenerating(false);
  }, [generationTimeoutId]);

  return (
    <div className="App">
      <div className="tabs-bar">
        <div className="tabs-container">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={tab.name}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-name">{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="main-content">
        <div className="left-panel">
          {activeTab === 'generation' && (
            <ControlPanel 
              config={mapConfig}
              onConfigChange={handleGenerateMap}
              isGenerating={isGenerating}
            />
          )}
          {activeTab === 'climate' && (
            <ClimateControlPanel 
              onOpacityChange={setClimateOpacity}
            />
          )}
        </div>
        
        <div className="right-panel">
          <MapCanvas 
            config={mapConfig} 
            onMapGenerated={handleMapGenerated}
            isGenerating={isGenerating}
            activeTab={activeTab}
            climateOpacity={climateOpacity}
          />
        </div>
      </div>
    </div>
  );
}

export default App
