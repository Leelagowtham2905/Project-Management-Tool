import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

import KanbanBoard from '../components/KanbanBoard';
import SprintCreation from '../components/SprintCreation';

const Dashboard = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState(null);
  const [sprints, setSprints] = useState([]);
  const [activeSprint, setActiveSprint] = useState(null);
  const [showCreation, setShowCreation] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProject();
    fetchSprints();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/project/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setProject(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSprints = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/project/${projectId}/sprints`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setSprints(data);
      if (data.length > 0 && !activeSprint) {
        setActiveSprint(data[0]);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };



  const handleSprintCreated = (sprintId) => {
    setShowCreation(false);
    fetchSprints();
  };

  if (loading) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="main-content fade-in">
      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h2 className="form-label">Sprints</h2>
          <span style={{ color: '#333' }}>/</span>
          <h2 style={{ fontSize: '14px', fontWeight: 600 }}>{activeSprint?.name || 'No Active Sprint'}</h2>
        </div>
        <button 
          onClick={() => setShowCreation(true)}
          className="btn-primary"
          style={{ width: 'auto', marginTop: 0, paddingInline: '16px' }}
        >
          + Create Sprint
        </button>
      </header>

      <div style={{ padding: '24px', height: 'calc(100% - 56px)' }}>
        {activeSprint ? (
          <KanbanBoard sprintId={activeSprint.id} members={project?.members || []} />
        ) : (

          <div className="flex-center" style={{ flexDirection: 'column', gap: '16px', color: 'var(--text-secondary)' }}>
            <p>No sprints found. Create one with AI to get started.</p>
            <button 
              onClick={() => setShowCreation(true)}
              className="btn-primary"
              style={{ width: 'auto', marginTop: 0 }}
            >
              Start Sprint Planning
            </button>
          </div>
        )}
      </div>

      {showCreation && (
        <SprintCreation 
          projectId={projectId}
          onClose={() => setShowCreation(false)} 
          onCreated={handleSprintCreated} 
        />
      )}
    </div>
  );
};

export default Dashboard;
