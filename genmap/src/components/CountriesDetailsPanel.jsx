import React from 'react';
import './CountriesDetailsPanel.css';

const CountriesDetailsPanel = ({ country }) => {

  if (!country) {
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
        <span style={{ fontSize: '24px' }}>🗺</span>
        <span style={{ fontWeight: 500 }}>Hover over a country to see details</span>
      </div>
    );
  }

  return (
    <div className="countries-details-panel">
      <div className="countries-details-header">
        <div className="country-color-dot" style={{ backgroundColor: country.color }} />
        <h2>{country.name}</h2>
      </div>

      <div className="countries-details-content">
        <div className="detail-row">
          <span className="detail-label">👑 Capital</span>
          <span className="detail-value">{country.capitalCity.name}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">👥 Population</span>
          <span className="detail-value">{Math.round(country.population).toLocaleString()}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">📐 Area</span>
          <span className="detail-value">{country.area.toLocaleString()} px²</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">🏙 Cities</span>
          <span className="detail-value">{country.cities.length}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">🌿 Main Biome</span>
          <span className="detail-value">Biome #{country.mainBiome}</span>
        </div>

        <div className="detail-row">
          <span className="detail-label">🌡 Climate</span>
          <span className="detail-value">{country.mainClimate}</span>
        </div>

        {country.cities.length > 0 && (
          <div className="cities-section">
            <div className="cities-title">🗺 Cities in this country</div>
            <div className="cities-list">
              {country.cities.map((city, idx) => (
                <div key={idx} className="city-item">
                  <span className="city-name">{city.name}</span>
                  {country.capitalCity === city && <span className="capital-badge">CAPITAL</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CountriesDetailsPanel;
