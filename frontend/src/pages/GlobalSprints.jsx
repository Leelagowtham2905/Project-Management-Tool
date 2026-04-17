import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const GlobalSprints = () => {
  const [sprints, setSprints] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSprints();
  }, []);

  const fetchSprints = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/all-sprints', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setSprints(data);

    } catch (err) { console.error(err); }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '32px' }}>All Sprints</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {sprints.map(sprint => (
          <div 
            key={sprint.id} 
            className="project-card" 
            onClick={() => navigate(`/project/${sprint.project_id}`)}
          >
            <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>{sprint.name}</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Project ID: {sprint.project_id}</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span className="badge badge-medium">{sprint.sprint_days} Days</span>
              <span style={{ fontSize: '12px', color: '#444' }}>Created {new Date(sprint.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GlobalSprints;
