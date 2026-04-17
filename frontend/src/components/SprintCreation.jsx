import React, { useState } from 'react';

const SprintCreation = ({ projectId, onClose, onCreated }) => {

  const [goal, setGoal] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!goal.trim()) return;
    setIsPlanning(true);
    setError('');
    try {
      const response = await fetch('http://127.0.0.1:8000/sprint/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ goal, project_id: projectId }),

      });
      const data = await response.json();
      if (response.ok) {
        onCreated(data.sprint_id);
      } else {
        setError(data.detail || 'Failed to create sprint');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsPlanning(false);
    }
  };

  return (
    <div className="modal-overlay fade-in">
      <div className="modal-content-sm">
        <div>
          <h2 className="auth-title" style={{ textAlign: 'left', marginBottom: '8px' }}>New Sprint Plan</h2>
          <p className="form-label">Describe your goal and let AI create the tickets.</p>
        </div>

        <textarea
          style={{ width: '100%', height: '120px' }}
          placeholder="e.g. Build a user profile page..."
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          disabled={isPlanning}
        />
        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} className="auth-link" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleCreate} disabled={!goal.trim() || isPlanning} className="btn-primary" style={{ width: 'auto', marginTop: 0, paddingInline: '24px' }}>
            {isPlanning ? 'Planning...' : 'Generate Sprint'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SprintCreation;
