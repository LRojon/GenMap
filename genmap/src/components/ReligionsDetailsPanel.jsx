import React from 'react';
import './ReligionsDetailsPanel.css';

export default function ReligionsDetailsPanel({ religions = [] }) {
  if (!religions || religions.length === 0) {
    return (
      <div className="religions-panel">
        <h2>Religions</h2>
        <p className="no-data">Generate a map to see religions</p>
      </div>
    );
  }

  return (
    <div className="religions-panel">
      <h2>Religions ({religions.length})</h2>
      <div className="religions-list">
        {religions.map((religion) => (
          <div key={religion.id} className="religion-card">
            <div className="religion-header">
              <div 
                className="religion-color" 
                style={{ backgroundColor: religion.color }}
              />
              <div className="religion-info">
                <h3>{religion.name}</h3>
                <p className="theme">{religion.deityTheme}</p>
              </div>
            </div>
            <div className="religion-details">
              <p><strong>Status:</strong> <span className={`status status-${religion.status || 'active'}`}>{(religion.status || 'active').toUpperCase()}</span></p>
              <p><strong>Founding City:</strong> {religion.foundingCity?.name || 'Unknown'}</p>
              <p><strong>Founding Year:</strong> {religion.foundingYear}</p>
              <p><strong>Followers:</strong> {religion.followers?.size || 0} cities</p>
              {religion.followers && religion.followers.size > 0 && (
                <div className="followers-list">
                  <strong>Cities with followers:</strong>
                  <ul>
                    {Array.from(religion.followers.entries()).map(([posKey, count]) => (
                      <li key={posKey}>
                        {posKey}: <span className="follower-count">{count}</span>%
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {religion.schisms && religion.schisms.length > 0 && (
                <div className="schisms">
                  <strong>Schisms:</strong> {religion.schisms.length}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
