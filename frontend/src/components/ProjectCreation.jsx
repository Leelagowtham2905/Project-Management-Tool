import React, { useState } from 'react';

const ProjectCreation = ({ onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Split emails by comma and trim
    const memberList = members ? members.split(',').map(m => m.trim()).filter(m => m) : [];

    try {
      const response = await fetch('http://127.0.0.1:8000/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name, description, members: memberList })
      });
      
      if (response.ok) {
        onCreated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content-sm fade-in">
        <div className="modal-header">
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Create New Project</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 32px 32px' }}>

          <div className="form-group">
            <label className="form-label">Project Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              required 
              placeholder="e.g. SprintMind Redesign"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input 
              type="text" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="What is this project about?"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Members (emails, comma separated)</label>
            <input 
              type="text" 
              value={members} 
              onChange={(e) => setMembers(e.target.value)} 
              placeholder="colleague@example.com, friend@example.com"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProjectCreation;
