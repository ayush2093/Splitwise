import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Link, useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar({ refreshTrigger, onGroupCreated }) {
  const { user, logout } = useAuth();
  const [groups, setGroups] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  const fetchGroups = async () => {
    try {
      const data = await api.get('/groups');
      setGroups(data.groups);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user, refreshTrigger]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    
    setError('');
    try {
      const data = await api.post('/groups', { name: newGroupName.trim() });
      setNewGroupName('');
      setShowCreateModal(false);
      fetchGroups();
      if (onGroupCreated) onGroupCreated();
      // Navigate to the newly created group
      navigate(`/group/${data.group.id}`);
    } catch (err) {
      setError(err.message || 'Failed to create group');
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Link to="/" className="sidebar-logo">
          Split<span>wise</span>
        </Link>
      </div>

      <div className="sidebar-nav">
        <div className="sidebar-section-title">
          <span>Groups</span>
          <button 
            className="btn btn-link" 
            onClick={() => setShowCreateModal(true)}
            style={{ fontSize: '1.25rem', padding: '0 0.5rem' }}
          >
            +
          </button>
        </div>

        <ul className="sidebar-list">
          <li>
            <Link 
              to="/" 
              className={`sidebar-item-link ${location.pathname === '/' ? 'active' : ''}`}
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link 
              to="/import" 
              className={`sidebar-item-link ${location.pathname === '/import' ? 'active' : ''}`}
            >
              📥 Import CSV Data
            </Link>
          </li>
          <li>
            <Link 
              to="/reports" 
              className={`sidebar-item-link ${location.pathname === '/reports' ? 'active' : ''}`}
            >
              📊 Import Reports
            </Link>
          </li>
          {groups.map(g => (
            <li key={g.id}>
              <Link 
                to={`/group/${g.id}`}
                className={`sidebar-item-link ${location.pathname === `/group/${g.id}` ? 'active' : ''}`}
              >
                📁 {g.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {user && (
        <div className="sidebar-footer">
          <div className="user-profile-info">
            <span className="user-profile-name">{user.name}</span>
            <span className="user-profile-email">{user.email}</span>
          </div>
          <button onClick={logout} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            Logout
          </button>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create a new group</h3>
              <button className="modal-close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateGroup}>
              {error && <div className="error-banner">{error}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="groupName">Group Name</label>
                <input 
                  type="text" 
                  id="groupName" 
                  className="form-input" 
                  placeholder="e.g. Apartment, Road Trip" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Group</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
