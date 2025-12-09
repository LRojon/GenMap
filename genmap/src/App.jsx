import React, { useState, useCallback } from 'react';
import './App.css';
import MapCanvas from './components/MapCanvas';
import ControlPanel from './components/ControlPanel';
import ClimateControlPanel from './components/ClimateControlPanel';
import BiomeControlPanel from './components/BiomeControlPanel';
import CountriesDetailsPanel from './components/CountriesDetailsPanel';
import CitiesDetailsPanel from './components/CitiesDetailsPanel';
import ReligionsDetailsPanel from './components/ReligionsDetailsPanel';
import CulturesDetailsPanel from './components/CulturesDetailsPanel';

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
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const [hoveredCity, setHoveredCity] = useState(null);
  const [religions, setReligions] = useState([]);
  const [cultures, setCultures] = useState([]);
  const [religionSystem, setReligionSystem] = useState(null);
  const [generationId, setGenerationId] = useState(0); // Identifiant unique pour forcer les générations

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
    setGenerationId(prev => prev + 1); // Force une génération même si le seed est identique
  }, []);

  const handleMapGenerated = useCallback((mapData) => {
    setIsGenerating(false);
    if (mapData) {
      if (mapData.religions) {
        setReligions(mapData.religions);
      }
      if (mapData.cultures) {
        setCultures(mapData.cultures);
      }
      if (mapData.religionSystem) {
        setReligionSystem(mapData.religionSystem);
      }
    }
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
          {activeTab === 'countries' && (
            <CountriesDetailsPanel 
              country={hoveredCountry}
            />
          )}
          {activeTab === 'cities' && (
            <CitiesDetailsPanel 
              city={hoveredCity}
            />
          )}
          {activeTab === 'religions' && (
            <ReligionsDetailsPanel 
              religions={religions}
            />
          )}
          {activeTab === 'cultures' && (
            <CulturesDetailsPanel 
              cultures={cultures}
            />
          )}
        </div>
        
        <div className="right-panel">
          <MapCanvas 
            config={mapConfig}
            generationId={generationId}
            onMapGenerated={handleMapGenerated}
            isGenerating={isGenerating}
            activeTab={activeTab}
            climateOpacity={climateOpacity}
            onBiomeHover={setHoveredBiomeId}
            onCountryHover={setHoveredCountry}
            onCityHover={setHoveredCity}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
