import React, { useState, useEffect } from 'react';
import TicketModal from './TicketModal';

const KanbanBoard = ({ sprintId, members }) => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [creatingInColumn, setCreatingInColumn] = useState(null); // Just for simple inline titles if needed elsewhere
  const [showDetailedAdd, setShowDetailedAdd] = useState(false);
  const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'medium' });




  useEffect(() => {
    fetchTickets();
  }, [sprintId]);

  const fetchTickets = async () => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/sprint/${sprintId}/tickets`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setTickets(data);

      setLoading(false);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const columns = [
    { id: 'todo', title: 'Todo', icon: '⭕' },
    { id: 'in_progress', title: 'In Progress', icon: '🟡' },
    { id: 'done', title: 'Done', icon: '🟢' },
  ];

  const filteredTickets = tickets.filter(t => {
    if (assigneeFilter === 'all') return true;
    return t.assigned_to_id === parseInt(assigneeFilter);
  });

  const handleDragStart = (e, ticketId) => {
    e.dataTransfer.setData('ticketId', ticketId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData('ticketId');
    const ticket = tickets.find(t => t.id === parseInt(ticketId));
    
    if (ticket && ticket.status !== targetStatus) {
      // Optimistic update
      setTickets(tickets.map(t => 
        t.id === ticket.id ? { ...t, status: targetStatus } : t
      ));

      try {
        await fetch(`http://127.0.0.1:8000/ticket/${ticket.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ status: targetStatus }),
        });
      } catch (err) {
        console.error(err);
        fetchTickets(); // Revert on error
      }
    }
  };

  const handlePriorityChange = async (e, ticketId) => {
    e.stopPropagation();
    const newPriority = e.target.value;
    // Optimistic update
    setTickets(tickets.map(t => 
      t.id === ticketId ? { ...t, priority: newPriority } : t
    ));

    try {
      await fetch(`http://127.0.0.1:8000/ticket/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ priority: newPriority }),
      });
    } catch (err) {
      console.error(err);
      fetchTickets();
    }
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const first = name[0];
    const last = name[name.length - 1];
    return (first + last).toUpperCase();
  };

  const handleAddDetailedTask = async () => {
    if (!newTicket.title.trim()) return;

    try {
      const response = await fetch(`http://127.0.0.1:8000/sprint/${sprintId}/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          ...newTicket,
          status: 'todo'
        })
      });

      if (response.ok) {
        setNewTicket({ title: '', description: '', priority: 'medium' });
        setShowDetailedAdd(false);
        fetchTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };



  if (loading) return <div>Loading board...</div>;

  return (
    <div className="kanban-wrapper">
      <div className="board-filters">
        <div className="filter-group">
          <span className="form-label" style={{ marginBottom: 0 }}>Filter by Assignee:</span>
          <select 
            value={assigneeFilter} 
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Members</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="kanban-container">
      {columns.map(col => (
        <div 
          key={col.id} 
          className="kanban-column"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, col.id)}
        >
          <div className="column-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="column-title">
              <span style={{ fontSize: '10px' }}>{col.icon}</span>
              {col.title}
              <span className="ticket-count">
                {filteredTickets.filter(t => t.status === col.id).length}
              </span>
            </h3>
            {col.id === 'todo' && (
              <button 
                onClick={() => setShowDetailedAdd(!showDetailedAdd)}
                style={{ 
                  background: 'var(--accent-primary)', 
                  border: 'none', 
                  color: 'white', 
                  borderRadius: '4px', 
                  padding: '2px 8px', 
                  fontSize: '18px', 
                  cursor: 'pointer',
                  lineHeight: '1'
                }}
                title="Add Task"
              >+</button>
            )}
          </div>

          {col.id === 'todo' && showDetailedAdd && (
            <div className="ticket-card" style={{ marginBottom: '16px', border: '1px solid var(--accent-primary)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input 
                placeholder="Task title..." 
                className="filter-select"
                style={{ width: '100%', background: 'transparent' }}
                value={newTicket.title}
                onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
              />
              <textarea 
                placeholder="Description..." 
                className="filter-select"
                style={{ width: '100%', background: 'transparent', minHeight: '60px', fontSize: '12px' }}
                value={newTicket.description}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <select 
                  className={`priority-select priority-${newTicket.priority}`}
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                >
                  <option value="high">High</option>
                  <option value="medium">Med</option>
                  <option value="low">Low</option>
                </select>
                <div style={{ display: 'flex', gap: '8px' }}>
                   <button onClick={() => setShowDetailedAdd(false)} className="btn-primary" style={{ background: 'transparent', border: 'none', fontSize: '12px', width: 'auto' }}>Cancel</button>
                   <button onClick={handleAddDetailedTask} className="btn-primary" style={{ width: 'auto', padding: '4px 12px', fontSize: '12px' }}>Create</button>
                </div>
              </div>
            </div>
          )}


          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '100px' }}>
            {filteredTickets.filter(t => t.status === col.id).map(ticket => {
              const assignee = members.find(m => m.id === ticket.assigned_to_id);
              return (
                <div 
                  key={ticket.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, ticket.id)}
                  onClick={() => setSelectedTicket(ticket)}
                  className="ticket-card"
                >
                  <h4 className="ticket-title">{ticket.title}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select 
                        value={ticket.priority} 
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handlePriorityChange(e, ticket.id)}
                        className={`priority-select priority-${ticket.priority}`}
                      >
                        <option value="high">High</option>
                        <option value="medium">Med</option>
                        <option value="low">Low</option>
                      </select>
                      <span style={{ fontSize: '10px', color: '#444' }}>SM-{ticket.id}</span>
                    </div>
                    {assignee && (
                      <div className="user-avatar-sm" title={assignee.name}>
                        {getInitials(assignee.name)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {creatingInColumn === col.id ? (
              <div className="ticket-card" style={{ padding: '8px', borderStyle: 'dashed' }}>
                <input 
                  autoFocus
                  className="filter-select"
                  style={{ width: '100%', marginBottom: '8px', background: 'transparent', border: '1px solid var(--border-color)' }}
                  placeholder="Task title..."
                  value={newTicketTitle}
                  onChange={(e) => setNewTicketTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTask(col.id);
                    if (e.key === 'Escape') setCreatingInColumn(null);
                  }}
                  onBlur={() => handleAddTask(col.id)}
                />
              </div>
            ) : (
              <button 
                className="add-task-btn" 
                onClick={() => setCreatingInColumn(col.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  cursor: 'pointer',
                  opacity: 0.6,
                  transition: 'opacity 0.2s'
                }}
              >
                <span>+</span> Add Task
              </button>
            )}
          </div>

        </div>
      ))}



      {selectedTicket && (
        <TicketModal 
          ticket={selectedTicket} 
          members={members}
          onClose={() => {
            setSelectedTicket(null);
            fetchTickets();
          }} 
        />
      )}
      </div>
    </div>
  );
};


export default KanbanBoard;
