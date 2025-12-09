import React from 'react';
import './CulturesDetailsPanel.css';

export default function CulturesDetailsPanel({ cultures = [] }) {
  if (!cultures || cultures.length === 0) {
    return (
      <div className="cultures-panel">
        <h2>Cultures</h2>
        <p className="no-data">Generate a map to see cultures</p>
      </div>
    );
  }

  return (
    <div className="cultures-panel">
      <h2>Cultures ({cultures.length})</h2>
      <div className="cultures-list">
        {cultures.map((culture) => (
          <div key={culture.id} className="culture-card">
            <div className="culture-header">
              <div 
                className="culture-color" 
                style={{ backgroundColor: culture.color }}
              />
              <div className="culture-info">
                <h3>{culture.name}</h3>
                <p className="climate-type">{culture.climateType || 'Unknown'}</p>
              </div>
            </div>
            <div className="culture-details">
              <p><strong>Origin City:</strong> {culture.originCity?.name || 'Unknown'}</p>
              <p><strong>Founded Year:</strong> {culture.foundingYear || '—'}</p>
              <p><strong>Climate Type:</strong> {culture.climateType}</p>
              
              {culture.traits && Object.keys(culture.traits).length > 0 && (
                <div className="traits-section">
                  <strong>Cultural Traits:</strong>
                  <ul className="traits-list">
                    {Object.entries(culture.traits).map(([traitType, traitValue]) => (
                      <li key={traitType}>
                        <span className="trait-type">{traitType}:</span>
                        <span className="trait-value">{traitValue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {culture.influencedBy && culture.influencedBy.length > 0 && (
                <div className="influences">
                  <strong>Influenced by:</strong> {culture.influencedBy.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
