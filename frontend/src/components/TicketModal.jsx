import React, { useState, useEffect } from 'react';

const TicketModal = ({ ticket, members, onClose }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMode, setAiMode] = useState('help');
  const [status, setStatus] = useState(ticket.status);
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to_id || 0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(ticket.title);
  const [editedDescription, setEditedDescription] = useState(ticket.description || '');



  useEffect(() => {
    fetchComments();
  }, [ticket.id]);

  const fetchComments = async () => {
    try {
      const resp = await fetch(`http://127.0.0.1:8000/ticket/${ticket.id}/comments`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setComments(await resp.json());
    } catch (err) { console.error(err); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await fetch(`http://127.0.0.1:8000/ticket/${ticket.id}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ content: newComment }),
      });
      setNewComment('');
      fetchComments();
    } catch (err) { console.error(err); }
  };

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    setStatus(newStatus);
    try {
      await fetch(`http://127.0.0.1:8000/ticket/${ticket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) { console.error(err); }
  };

  const handleAssigneeChange = async (e) => {
    const newAssigneeId = parseInt(e.target.value);
    setAssignedTo(newAssigneeId);
    try {
      await fetch(`http://127.0.0.1:8000/ticket/${ticket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ assigned_to_id: newAssigneeId }),
      });
    } catch (err) { console.error(err); }
  };

  const handleSave = async () => {
    try {
      await fetch(`http://127.0.0.1:8000/ticket/${ticket.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          title: editedTitle, 
          description: editedDescription 
        }),
      });
      setIsEditing(false);
      // We don't need to fetch tickets here because onClose calls fetchTickets in KanbanBoard
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this task? This action cannot be undone.')) return;
    try {
      const resp = await fetch(`http://127.0.0.1:8000/ticket/${ticket.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (resp.ok) {
        onClose();
      }
    } catch (err) { console.error(err); }
  };

  const runAiAssistant = async () => {


    setIsAiLoading(true);
    setAiResult('');
    try {
      const resp = await fetch(`http://127.0.0.1:8000/ticket/${ticket.id}/ai-comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          mode: aiMode,
          question: aiMode === 'help' ? aiInput : null,
          content: aiMode === 'edit' ? aiInput : null
        }),

      });
      const data = await resp.json();
      setAiResult(data.result);
    } catch (err) { console.error(err); }
    finally { setIsAiLoading(false); }
  };

  return (
    <div className="modal-overlay fade-in">
      <div className="modal-content-lg">
        <header className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="form-label">SM-{ticket.id}</span>
            <div className={`badge badge-${ticket.priority}`}>{ticket.priority}</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </header>

        <div className="modal-body">
          <section>
            {isEditing ? (
              <input 
                value={editedTitle} 
                onChange={(e) => setEditedTitle(e.target.value)}
                style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', width: '100%', background: 'transparent', border: '1px solid var(--border-color)', color: 'white' }}
              />
            ) : (
              <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>{editedTitle}</h1>
            )}

            <div style={{ display: 'flex', gap: '32px', marginBottom: '24px', alignItems: 'center' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <span className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>STATUS</span>
                <select 
                  value={status} 
                  onChange={handleStatusChange} 
                  className="premium-select"
                >
                  <option value="todo">Todo</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <span className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ASSIGN TO</span>
                <select 
                  value={assignedTo} 
                  onChange={handleAssigneeChange} 
                  className="premium-select"
                >
                  <option value="0">Unassigned</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>


            <div className="form-group">
              <span className="form-label" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>DESCRIPTION</span>
              {isEditing ? (
                <textarea 
                  value={editedDescription} 
                  onChange={(e) => setEditedDescription(e.target.value)}
                  style={{ minHeight: '120px', width: '100%', padding: '12px' }}
                />
              ) : (
                <div style={{ padding: '16px', backgroundColor: 'var(--card-bg)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '14px', lineHeight: '1.6', color: '#cecfd1' }}>
                  {editedDescription || 'No description provided.'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              {isEditing ? (
                <button onClick={handleSave} className="btn-primary" style={{ width: 'auto' }}>Save Changes</button>
              ) : (
                <button onClick={() => setIsEditing(true)} className="btn-primary" style={{ width: 'auto', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)' }}>Edit Task</button>
              )}
              <button onClick={handleDelete} className="btn-primary" style={{ width: 'auto', backgroundColor: '#3a1111', color: '#ff4d4d', border: '1px solid #5a1a1a' }}>Delete Task</button>
            </div>
          </section>


          <section style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 className="form-label" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '16px' }}>Activity</h3>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {comments.map(c => (
                <div key={c.id} style={{ padding: '12px', backgroundColor: 'rgba(17,18,20,0.5)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>User <span style={{ color: '#444', marginLeft: '8px' }}>{new Date(c.created_at).toLocaleString()}</span></div>
                  <p style={{ fontSize: '14px' }}>{c.content}</p>
                </div>
              ))}
            </div>

            <div className="form-group" style={{ marginTop: 'auto' }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                style={{ height: '80px', marginBottom: '8px' }}
              />
              <button onClick={handleAddComment} className="btn-primary" style={{ width: 'auto', alignSelf: 'flex-start' }}>Post Comment</button>
            </div>
          </section>

          <section className="ai-section">
            <div className="ai-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✨</span>
                <h4 className="form-label" style={{ color: 'white', marginBottom: 0 }}>AI Assistant</h4>
              </div>
              <div className="ai-toggle">
                <button onClick={() => setAiMode('help')} className={`toggle-btn ${aiMode === 'help' ? 'active' : ''}`}>Help</button>
                <button onClick={() => setAiMode('edit')} className={`toggle-btn ${aiMode === 'edit' ? 'active' : ''}`}>Refine</button>
              </div>
            </div>

            {aiMode === 'help' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

                <input type="text" placeholder="Ask about this ticket..." value={aiInput} onChange={(e) => setAiInput(e.target.value)} style={{ width: '100%' }} />
                <button onClick={runAiAssistant} className="btn-primary" style={{ marginTop: '8px', padding: '8px' }} disabled={isAiLoading}>
                  {isAiLoading ? 'Thinking...' : 'Ask AI'}
                </button>
              </div>
            ) : (
              <button onClick={runAiAssistant} className="btn-primary" style={{ padding: '8px' }} disabled={isAiLoading || !newComment.trim()}>
                {isAiLoading ? 'Refining...' : 'Refine Draft'}
              </button>
            )}

            {aiResult && (
              <div className="ai-result">
                <p style={{ fontSize: '13px', lineHeight: '1.5' }}>{aiResult}</p>
                {aiMode === 'edit' && (
                  <button onClick={() => { setNewComment(aiResult); setAiResult(''); }} className="auth-link" style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'block', marginTop: '8px', fontSize: '12px' }}>Apply Refinement</button>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default TicketModal;
