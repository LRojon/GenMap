import React from 'react';
import './CitiesDetailsPanel.css';

const CitiesDetailsPanel = ({ city }) => {

  if (!city) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#666',
        fontSize: '14px',
        textAlign: 'center',
        padding: '20px',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <span style={{ fontSize: '24px' }}>🏘️</span>
        <span style={{ fontWeight: 500 }}>Hover over a city to see details</span>
      </div>
    );
  }

  return (
    <div className="cities-details-panel">
      <div className="cities-details-header">
        <span style={{ fontSize: '24px' }}>🏙️</span>
        <div>
          <h2>{city.name}</h2>
          <div style={{ fontSize: '12px', color: '#0a0a0a', fontWeight: 600, marginTop: '-4px' }}>
            {city.cityType ? city.cityType.charAt(0).toUpperCase() + city.cityType.slice(1) : 'Village'}
          </div>
        </div>
      </div>

      <div className="cities-details-content">
        <div className="detail-row">
          <span className="detail-label">👥 Population</span>
          <span className="detail-value">{Math.round(city.population).toLocaleString()}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">📍 Position</span>
          <span className="detail-value">({city.position[0]}, {city.position[1]})</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">⛰️ Altitude</span>
          <span className="detail-value">{(city.altitude * 100 / 255).toFixed(1)}%</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">🌡️ Climate</span>
          <span className="detail-value">{(city.climate * 100 / 255).toFixed(1)}%</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">⭐ Score</span>
          <span className="detail-value">{Math.round(city.score)}</span>
        </div>

        {city.specialization && (
          <div className="detail-row">
            <span className="detail-label">🎯 Specialization</span>
            <span className="detail-value">{city.specialization.charAt(0).toUpperCase() + city.specialization.slice(1)}</span>
          </div>
        )}

        {city.landmark && (
          <div className="detail-row">
            <span className="detail-label">🏛️ Landmark</span>
            <span className="detail-value">{city.landmark}</span>
          </div>
        )}

        {city.threatLevel && (
          <div className="detail-row">
            <span className="detail-label">⚔️ Threats</span>
            <span className={`detail-value threat-level-${city.threatLevel.toLowerCase()}`}>{city.threatLevel}</span>
          </div>
        )}

        {city.prosperity && (
          <div className="detail-row">
            <span className="detail-label">💰 Prosperity</span>
            <span className="detail-value">{city.prosperity}</span>
          </div>
        )}

        {city.foundedYear !== 0 && (
          <div className="detail-row">
            <span className="detail-label">📅 Founded</span>
            <span className="detail-value">{city.foundedYear > 0 ? city.foundedYear : `Year ${Math.abs(city.foundedYear)}`}</span>
          </div>
        )}

        {city.government && (
          <div className="detail-row">
            <span className="detail-label">⚖️ Government</span>
            <span className="detail-value">{city.government}</span>
          </div>
        )}

        {city.religion && (
          <div className="detail-row">
            <span className="detail-label">⛩️ Religion</span>
            <span className="detail-value">{city.religion}</span>
          </div>
        )}

        {city.culture && (
          <div className="detail-row">
            <span className="detail-label">🎭 Culture</span>
            <span className="detail-value">{city.culture}</span>
          </div>
        )}

        {city.resources && Object.keys(city.resources).length > 0 && (
          <div className="resources-section">
            <div className="resources-title">📦 Resources</div>
            <div className="resources-grid">
              {Object.entries(city.resources).map(([resource, value]) => (
                <div key={resource} className="resource-item">
                  <span className="resource-name">{resource}</span>
                  <div className="resource-bar">
                    <div className="resource-fill" style={{ width: `${Math.max(1, value)}%` }}></div>
                  </div>
                  <span className="resource-value">{Math.round(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {city.country && (
          <div className="detail-row">
            <span className="detail-label">🗺️ Country</span>
            <span className="detail-value">{city.country}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CitiesDetailsPanel;
