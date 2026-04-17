import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const Sidebar = ({ onLogout }) => {

  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'projects', label: 'Projects', icon: '📁', path: '/' },
    { id: 'inbox', label: 'Inbox', icon: '📥', path: '/inbox' },
    { id: 'my-issues', label: 'My Issues', icon: '⭕', path: '/my-issues' },
    { id: 'sprints', label: 'Sprints', icon: '🚀', path: '/sprints' },
  ];

  return (
    <aside className="sidebar">
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
          <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--accent-primary)', borderRadius: '4px' }}></div>
          <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>SprintMind</span>
        </div>

        <nav>
          {menuItems.map(item => (
            <div 
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>
      </div>

      <div style={{ 
        marginTop: 'auto', 
        paddingTop: '16px', 
        borderTop: '1px solid var(--border-color)' 
      }}>
        <button 
          onClick={onLogout}
          className="sidebar-item"
          style={{ 
            color: 'var(--danger)', 
            marginTop: '8px',
            background: 'none',
            border: 'none',
            width: '100%',
            textAlign: 'left'
          }}
        >
          <span style={{ marginRight: '12px' }}>🚪</span>
          Sign out
        </button>
      </div>

    </aside>
  );
};

export default Sidebar;

