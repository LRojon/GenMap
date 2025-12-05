import React, { useEffect, useRef, useState } from 'react';
import './MapCanvas.css';
import { getColorFromHeight, getColorFromClimate, getColorFromBiome, getColorFromRiver } from '../utils/colorPalette';
import { Map } from '../utils/map';
import CitiesPanel from './CitiesPanel';

const MapCanvas = ({ config, generationId, onMapGenerated, isGenerating, activeTab, climateOpacity = 70, onBiomeHover }) => {
    const canvasRef = useRef(null);
    const climateCanvasRef = useRef(null);
    const biomeCanvasRef = useRef(null);
    const riverCanvasRef = useRef(null);
    const biomeMapRef = useRef(null);
    const generationAbortRef = useRef(null);
    const [progress, setProgress] = useState(0);
    const [mapCities, setMapCities] = useState(null);

    useEffect(() => {
        // Créer un AbortController pour pouvoir annuler la génération
        const abortController = new AbortController();
        generationAbortRef.current = abortController;

        console.log('MapCanvas: useEffect triggered - seed:', config.seed);

        const generateMap = async () => {
            console.log('MapCanvas: generateMap started - seed:', config.seed);
            const canvas = canvasRef.current;
            const climateCanvas = climateCanvasRef.current;
            const biomeCanvas = biomeCanvasRef.current;
            const riverCanvas = riverCanvasRef.current;
            if (!canvas || !climateCanvas || !biomeCanvas || !riverCanvas) {
                console.log('MapCanvas: Canvas refs not ready');
                return;
            }

            const startTime = performance.now();

            try {
                const ctx = canvas.getContext('2d', { willReadFrequently: false });
                const climateCtx = climateCanvas.getContext('2d', { willReadFrequently: false });
                const biomeCtx = biomeCanvas.getContext('2d', { willReadFrequently: false });
                const riverCtx = riverCanvas.getContext('2d', { willReadFrequently: false });

                if (abortController.signal.aborted) {
                    console.log('MapCanvas: Aborted before setup');
                    return;
                }

                canvas.width = config.width;
                canvas.height = config.height;
                climateCanvas.width = config.width;
                climateCanvas.height = config.height;
                biomeCanvas.width = config.width;
                biomeCanvas.height = config.height;
                riverCanvas.width = config.width;
                riverCanvas.height = config.height;

                setProgress(10);

                // Générer la carte
                console.log('MapCanvas: Starting generation...');
                const mapInstance = new Map();
                mapInstance.generate(config.width, config.height, config.seed);

                if (abortController.signal.aborted) {
                    console.log('MapCanvas: Aborted after generation');
                    return;
                }

                setProgress(50);

                const heightMap1D = mapInstance.getHeightMap1D();
                const climateMap1D = mapInstance.getClimateMap1D();
                const biomeMap1D = mapInstance.getBiomeMap1D();
                const riverMap1D = mapInstance.getRiverMap1D();

                if (abortController.signal.aborted) {
                    console.log('MapCanvas: Aborted after map conversion');
                    return;
                }

                setProgress(75);

                // Dessiner hauteur
                const heightImageData = ctx.createImageData(config.width, config.height);
                const heightData = heightImageData.data;

                for (let i = 0; i < config.width * config.height; i++) {
                    const color = getColorFromHeight(heightMap1D[i]);
                    const idx = i * 4;
                    heightData[idx] = color[0];
                    heightData[idx + 1] = color[1];
                    heightData[idx + 2] = color[2];
                    heightData[idx + 3] = 255;
                }

                ctx.putImageData(heightImageData, 0, 0);

                if (abortController.signal.aborted) return;

                // Dessiner climat
                const climateImageData = climateCtx.createImageData(config.width, config.height);
                const climateData = climateImageData.data;

                for (let i = 0; i < config.width * config.height; i++) {
                    const color = getColorFromClimate(climateMap1D[i]);
                    const idx = i * 4;
                    climateData[idx] = color[0];
                    climateData[idx + 1] = color[1];
                    climateData[idx + 2] = color[2];
                    climateData[idx + 3] = 255;
                }

                climateCtx.putImageData(climateImageData, 0, 0);

                if (abortController.signal.aborted) return;

                // Dessiner biomes
                const biomeImageData = biomeCtx.createImageData(config.width, config.height);
                const biomeData = biomeImageData.data;

                for (let i = 0; i < config.width * config.height; i++) {
                    const color = getColorFromBiome(biomeMap1D[i]);
                    const idx = i * 4;
                    biomeData[idx] = color[0];
                    biomeData[idx + 1] = color[1];
                    biomeData[idx + 2] = color[2];
                    biomeData[idx + 3] = 255;
                }

                biomeCtx.putImageData(biomeImageData, 0, 0);

                if (abortController.signal.aborted) return;

                // Dessiner rivières (sur canvas transparent)
                if (riverMap1D) {
                    const riverImageData = riverCtx.createImageData(config.width, config.height);
                    const riverData = riverImageData.data;
                    const riverColor = getColorFromRiver();

                    for (let i = 0; i < config.width * config.height; i++) {
                        if (riverMap1D[i] === 1) {
                            // Rivière présente
                            const idx = i * 4;
                            riverData[idx] = riverColor[0];
                            riverData[idx + 1] = riverColor[1];
                            riverData[idx + 2] = riverColor[2];
                            riverData[idx + 3] = 200; // Légèrement transparent
                        }
                    }

                    riverCtx.putImageData(riverImageData, 0, 0);
                }

                if (abortController.signal.aborted) return;

                // Stocker la biome map pour la détection du hover
                biomeMapRef.current = biomeMap1D;

                // Stocker les cities
                setMapCities(mapInstance.cities);

                setProgress(100);
                const endTime = performance.now();
                console.log(`MapCanvas: Generation completed in ${(endTime - startTime).toFixed(2)}ms`);

                onMapGenerated({
                    heightMap: heightMap1D,
                    climateMap: climateMap1D,
                    biomeMap: biomeMap1D,
                    cities: mapInstance.cities,
                });
            } catch (error) {
                if (!abortController.signal.aborted) {
                    console.error('Error generating map:', error);
                    setProgress(0);
                    onMapGenerated({});
                }
            }
        };

        generateMap();

        // Cleanup: annuler la génération si le composant est unmounté ou config change
        return () => {
            console.log('MapCanvas: useEffect cleanup - aborting generation');
            abortController.abort();
        };
    }, [config.seed, config.width, config.height, generationId, onMapGenerated]);

    const handleBiomeCanvasMouseMove = (e) => {
        if (!biomeMapRef.current || !onBiomeHover) return;

        const canvas = biomeCanvasRef.current;
        const rect = canvas.getBoundingClientRect();
        
        // Calculer la position relative au canvas en tenant compte du scale
        const x = Math.floor((e.clientX - rect.left) / config.scale);
        const y = Math.floor((e.clientY - rect.top) / config.scale);

        // Vérifier les limites
        if (x >= 0 && x < config.width && y >= 0 && y < config.height) {
            const pixelIndex = y * config.width + x;
            const biomeId = biomeMapRef.current[pixelIndex];
            onBiomeHover(biomeId);
        }
    };

    const handleBiomeCanvasMouseLeave = () => {
        if (onBiomeHover) {
            onBiomeHover(null);
        }
    };

    return (
        <div className="map-canvas-container">
            <canvas
                ref={canvasRef}
                className="map-canvas"
                style={{
                    transform: `scale(${config.scale})`,
                    transformOrigin: 'center',
                }}
            />
            <canvas
                ref={climateCanvasRef}
                className="map-canvas climate-overlay"
                style={{
                    transform: `translate(-50%, -50%) scale(${config.scale})`,
                    transformOrigin: 'center',
                    opacity: activeTab === 'climate' ? climateOpacity / 100 : 0,
                    pointerEvents: activeTab === 'climate' ? 'auto' : 'none',
                }}
            />
            <canvas
                ref={biomeCanvasRef}
                className="map-canvas biome-overlay"
                onMouseMove={handleBiomeCanvasMouseMove}
                onMouseLeave={handleBiomeCanvasMouseLeave}
                style={{
                    transform: `translate(-50%, -50%) scale(${config.scale})`,
                    transformOrigin: 'center',
                    opacity: activeTab === 'biomes' ? 0.8 : 0,
                    pointerEvents: activeTab === 'biomes' ? 'auto' : 'none',
                }}
            />
            <canvas
                ref={riverCanvasRef}
                className="map-canvas river-overlay"
                style={{
                    transform: `translate(-50%, -50%) scale(${config.scale})`,
                    transformOrigin: 'center',
                    opacity: activeTab === 'generation' ? 1 : 0,
                    pointerEvents: 'none',
                }}
            />
            {mapCities && (
                <CitiesPanel 
                    cities={mapCities} 
                    config={config} 
                    activeTab={activeTab}
                    scale={config.scale}
                />
            )}
            {isGenerating && (
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
            )}
        </div>
    );
};

export default MapCanvas;


