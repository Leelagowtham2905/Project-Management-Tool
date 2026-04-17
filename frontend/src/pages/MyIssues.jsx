import React, { useState, useEffect } from 'react';

const MyIssues = () => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/my-issues', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setIssues(data);


    } catch (err) { console.error(err); }
    setLoading(false);
  };


  if (loading && issues.length === 0) return <div className="flex-center" style={{height: '100vh'}}>Loading your issues...</div>;

  return (
    <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '32px' }}>My Issues</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {issues.length > 0 ? issues.map(issue => (
          <div key={issue.id} className="ticket-card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 500 }}>{issue.title}</h3>
              <span className={`badge badge-${issue.status}`}>{issue.status.replace('_', ' ')}</span>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <span>SM-{issue.id}</span>
              <span className={`badge badge-${issue.priority}`}>{issue.priority}</span>
            </div>
          </div>
        )) : (
          <div className="flex-center" style={{ flexDirection: 'column', gap: '16px', marginTop: '100px', color: 'var(--text-secondary)' }}>
            <p>No issues assigned to you yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyIssues;
