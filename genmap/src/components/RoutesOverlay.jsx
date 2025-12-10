import React, { useEffect, useRef } from 'react';

const RoutesOverlay = ({ routes, config, scale = 1 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !routes || routes.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = config.width;
    canvas.height = config.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dessiner toutes les routes sur tous les onglets
    for (const route of routes) {
      const width = route.getWidth();
      const color = route.getColor();

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 1.0;

      ctx.beginPath();
      const [startX, startY] = route.path[0];
      ctx.moveTo(startX, startY);

      for (let i = 1; i < route.path.length; i++) {
        const [x, y] = route.path[i];
        ctx.lineTo(x, y);
      }

      ctx.stroke();
    }

  }, [routes, config]);

  return (
    <canvas
      ref={canvasRef}
      className="map-canvas routes-overlay"
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        transformOrigin: 'center',
        opacity: 1,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  );
};

export default RoutesOverlay;
