import React, { useEffect, useRef, useState } from 'react';
import './MapCanvas.css';
import { getColorFromHeight, getColorFromClimate } from '../utils/colorPalette';
import { Map } from '../utils/map';

const MapCanvas = ({ config, onMapGenerated, isGenerating, activeTab, climateOpacity = 70 }) => {
    const canvasRef = useRef(null);
    const climateCanvasRef = useRef(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const generateMap = async () => {
            const canvas = canvasRef.current;
            const climateCanvas = climateCanvasRef.current;
            if (!canvas || !climateCanvas) return;

            try {
                const ctx = canvas.getContext('2d');
                const climateCtx = climateCanvas.getContext('2d');

                canvas.width = config.width;
                canvas.height = config.height;
                climateCanvas.width = config.width;
                climateCanvas.height = config.height;

                setProgress(10);

                // Générer la carte
                const mapInstance = new Map();
                mapInstance.generate(config.width, config.height, config.seed);

                setProgress(50);

                const heightMap1D = mapInstance.getHeightMap1D();
                const climateMap1D = mapInstance.getClimateMap1D();

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

                setProgress(100);

                onMapGenerated({
                    heightMap: heightMap1D,
                    climateMap: climateMap1D,
                });
            } catch (error) {
                console.error('Error generating map:', error);
                setProgress(0);
                onMapGenerated({});
            }
        };

        generateMap();
    }, [config, onMapGenerated]);

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
            {activeTab === 'climate' && (
                <canvas
                    ref={climateCanvasRef}
                    className="map-canvas climate-overlay"
                    style={{
                        transform: `scale(${config.scale})`,
                        transformOrigin: 'center',
                        opacity: climateOpacity / 100,
                    }}
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
