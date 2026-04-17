import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectCreation from '../components/ProjectCreation';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [showCreation, setShowCreation] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/projects', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setProjects(data);

      setLoading(false);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (loading) return <div className="flex-center">Loading projects...</div>;

  return (
    <div className="main-content fade-in">
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '48px',
        paddingBottom: '24px',
        borderBottom: '1px solid var(--border-color)'
      }}>

        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '8px' }}>My Projects</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage and organize your team's development sprints.</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px', fontSize: '14px' }} onClick={() => setShowCreation(true)}>
          <span style={{ marginRight: '8px' }}>+</span> Create Project
        </button>
      </header>


      <div className="projects-grid">
        {projects.length === 0 ? (
          <div className="flex-center" style={{ flexDirection: 'column', gap: '16px' }}>
            <p style={{ color: 'var(--text-secondary)' }}>No projects found. Create your first project to get started!</p>
          </div>
        ) : (
          projects.map(project => (
            <div key={project.id} className="project-card" onClick={() => navigate(`/project/${project.id}`)}>
              <div className="project-card-top">
                <div className="project-icon-wrapper">
                  {project.name.charAt(0).toUpperCase()}
                </div>
                <div className="project-status-dot"></div>
              </div>
              <div className="project-info">
                <h3>{project.name}</h3>
                <p className="project-desc">{project.description || 'No description provided'}</p>
                <div className="project-footer">
                   <div className="members-stack">
                     <div className="member-avatar">U</div>
                     <div className="member-avatar" style={{ marginLeft: '-8px', background: 'var(--accent-primary)' }}>+</div>
                   </div>
                   <span className="owner-tag">
                     {project.owner_id === JSON.parse(localStorage.getItem('user'))?.id ? 'OWNER' : 'COLLABORATOR'}
                   </span>
                </div>
              </div>
            </div>

          ))
        )}
      </div>

      {showCreation && (
        <ProjectCreation 
          onClose={() => setShowCreation(false)} 
          onCreated={() => {
            setShowCreation(false);
            fetchProjects();
          }} 
        />
      )}
    </div>
  );
};

export default Projects;
