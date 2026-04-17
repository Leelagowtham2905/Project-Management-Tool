import React, { useState, useEffect } from 'react';

const Inbox = () => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbox();
  }, []);

  const fetchInbox = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/inbox', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setComments(data);

    } catch (err) { console.error(err); }
    setLoading(false);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '32px' }}>Inbox</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {comments.length > 0 ? comments.map(comment => (
          <div key={comment.id} style={{ 
            padding: '16px', 
            backgroundColor: 'var(--card-bg)', 
            border: '1px solid var(--border-color)',
            borderBottomWidth: 0,
            display: 'flex',
            gap: '16px'
          }}>
            <div className="user-avatar-sm" style={{flexShrink: 0}}>
              {comment.user_id}
            </div>
            <div>
              <p style={{ fontSize: '14px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600 }}>User {comment.user_id}</span> commented on 
                <span style={{ color: 'var(--accent-primary)', marginLeft: '4px' }}>Ticket #{comment.ticket_id}</span>
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>"{comment.content}"</p>
              <p style={{ fontSize: '11px', color: '#444', marginTop: '8px' }}>{new Date(comment.created_at).toLocaleString()}</p>
            </div>
          </div>
        )) : (
          <div className="flex-center" style={{ flexDirection: 'column', gap: '16px', marginTop: '100px', color: 'var(--text-secondary)' }}>
            <p>Your inbox is empty.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inbox;
