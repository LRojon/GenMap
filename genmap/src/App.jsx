import React, { useState, useCallback } from 'react';
import './App.css';
import MapCanvas from './components/MapCanvas';
import ControlPanel from './components/ControlPanel';
import ClimateControlPanel from './components/ClimateControlPanel';
import BiomeControlPanel from './components/BiomeControlPanel';

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
  const [climateOpacity, setClimateOpacity] = useState(70);
  const [hoveredBiomeId, setHoveredBiomeId] = useState(null);

  const tabs = [
    { id: 'generation', name: 'Generation', icon: '⚡' },
    { id: 'countries', name: 'Countries', icon: '🏛' },
    { id: 'cities', name: 'Cities', icon: '🏙' },
    { id: 'routes', name: 'Routes', icon: '🛣' },
    { id: 'biomes', name: 'Biomes', icon: '🌿' },
    { id: 'climate', name: 'Climate', icon: '🌡' },
    { id: 'religions', name: 'Religions', icon: '⛪' },
    { id: 'cultures', name: 'Cultures', icon: '🎭' },
  ];

  const handleGenerateMap = useCallback((config) => {
    setIsGenerating(true);
    setMapConfig(config);

    // Débloquer automatiquement après 5 minutes si la génération prend trop longtemps
    const timeoutId = setTimeout(() => {
      console.warn('Map generation timeout - resetting state');
      setIsGenerating(false);
    }, 300000); // 5 minutes

    return () => clearTimeout(timeoutId); // Cleanup
  }, []);

  const handleMapGenerated = useCallback((data) => {
    // Carte générée, données disponibles dans 'data'
    console.log('Map generated:', data);
    setIsGenerating(false);
  }, []);

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
          {activeTab === 'biomes' && (
            <BiomeControlPanel 
              hoveredBiomeId={hoveredBiomeId}
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
            onBiomeHover={setHoveredBiomeId}
          />
        </div>
      </div>
    </div>
  );
}

export default App
