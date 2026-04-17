import React, { useState, useEffect } from 'react';
import TicketModal from './TicketModal';

const KanbanBoard = ({ sprintId, members }) => {
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [loading, setLoading] = useState(true);


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
          <div className="column-header">
            <h3 className="column-title">
              <span style={{ fontSize: '10px' }}>{col.icon}</span>
              {col.title}
              <span className="ticket-count">
                {filteredTickets.filter(t => t.status === col.id).length}
              </span>
            </h3>
          </div>

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
