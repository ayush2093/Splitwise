import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';

export default function Dashboard({ onSeed }) {
  const { user: currentUser } = useAuth();
  
  const [data, setData] = useState({
    groups: [],
    netBalance: 0,
    owedAmount: 0,
    oweAmount: 0,
    debtsSummary: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [seeding, setSeeding] = useState(false);

  // Chat/Sockets State
  const [expenses, setExpenses] = useState([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const token = localStorage.getItem('token');

  // Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 4000);
  };

  const fetchDashboardData = async () => {
    try {
      const stats = await api.get('/dashboard');
      setData(stats);
    } catch (err) {
      setError('Failed to load dashboard data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Fetch expenses for the first group to support dashboard chat topics
  useEffect(() => {
    if (data.groups.length > 0) {
      const fetchGroupExpenses = async () => {
        try {
          const res = await api.get(`/groups/${data.groups[0].id}`);
          const expList = res.expenses || [];
          setExpenses(expList);
          if (expList.length > 0 && !selectedExpenseId) {
            setSelectedExpenseId(expList[0].id.toString());
          }
        } catch (err) {
          console.error('Failed to fetch group expenses for dashboard chat:', err);
        }
      };
      fetchGroupExpenses();
    } else {
      setExpenses([]);
      setSelectedExpenseId('');
    }
  }, [data.groups]);

  // Sockets Room Handling for selected chat topic
  useEffect(() => {
    if (!selectedExpenseId || !token) return;

    // 1. Fetch chat history
    const fetchChatHistory = async () => {
      try {
        const details = await api.get(`/expenses/${selectedExpenseId}`);
        setMessages(details.messages || []);
      } catch (err) {
        console.error('Failed to load chat history for dashboard:', err);
      }
    };
    fetchChatHistory();

    // 2. Connect to socket server
    const socketUrl = api.getBackendUrl();
    const socket = io(socketUrl, {
      auth: { token },
      extraHeaders: {
        'Bypass-Tunnel-Reminder': 'true'
      }
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_expense', parseInt(selectedExpenseId));
    });

    socket.on('receive_message', (payload) => {
      if (payload.expense_id === parseInt(selectedExpenseId)) {
        setMessages((prev) => {
          if (prev.some(m => m.id === payload.id)) return prev;
          return [...prev, payload];
        });
        setTypingUsers((prev) => prev.filter(u => u.userId !== payload.user_id));
      }
    });

    socket.on('user_typing', (typer) => {
      setTypingUsers((prev) => {
        if (prev.some(u => u.userId === typer.userId)) return prev;
        return [...prev, typer];
      });
    });

    socket.on('user_stop_typing', (typer) => {
      setTypingUsers((prev) => prev.filter(u => u.userId !== typer.userId));
    });

    socket.on('error_message', (errPayload) => {
      console.warn('Socket error:', errPayload.error);
    });

    // Fallback polling for serverless (Vercel) environments where sockets are not persistent
    const pollingInterval = setInterval(async () => {
      try {
        const details = await api.get(`/expenses/${selectedExpenseId}`);
        setMessages((prev) => {
          const merged = [...prev];
          (details.messages || []).forEach(newMsg => {
            if (!merged.some(m => m.id === newMsg.id)) {
              merged.push(newMsg);
            }
          });
          return merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        });
      } catch (err) {
        console.error('Error polling chat history:', err);
      }
    }, 3000);

    return () => {
      clearInterval(pollingInterval);
      if (socket) {
        socket.emit('leave_expense', parseInt(selectedExpenseId));
        socket.disconnect();
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setMessages([]);
      setTypingUsers([]);
    };
  }, [selectedExpenseId, token]);

  // Scroll to bottom when messages or typing states change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUsers]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (socketRef.current && selectedExpenseId) {
      socketRef.current.emit('typing', { expenseId: parseInt(selectedExpenseId) });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('stop_typing', { expenseId: parseInt(selectedExpenseId) });
      }, 1500);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedExpenseId) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socketRef.current) {
      socketRef.current.emit('stop_typing', { expenseId: parseInt(selectedExpenseId) });
    }

    try {
      // Always send messages via HTTP POST to guarantee DB save in serverless env
      const res = await api.post(`/expenses/${selectedExpenseId}/messages`, { message: msgText });
      
      // Update local state immediately for instant feedback
      setMessages((prev) => {
        if (prev.some(m => m.id === res.id)) return prev;
        return [...prev, res];
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message: ' + (err.message || 'Something went wrong'));
    }
  };

  const handleSeedDemoData = async () => {
    setSeeding(true);
    setError('');
    try {
      await api.post('/seed');
      showToast('Demo data seeded successfully! Try exploring the "Road Trip 2026" group.', 'success');
      await fetchDashboardData();
      if (onSeed) onSeed();
    } catch (err) {
      setError(err.message || 'Failed to seed demo data.');
      showToast('Seeding failed: ' + (err.message || ''), 'error');
    } finally {
      setSeeding(false);
    }
  };

  const getAvatarColorClass = (name) => {
    if (!name) return 'u';
    const firstLetter = name.toLowerCase().charAt(0);
    if (['a', 'e', 'i', 'o', 'u'].includes(firstLetter)) return 'a'; // vowels -> blue
    if (['b', 'f', 'j', 'p', 't', 'v'].includes(firstLetter)) return 'b'; // purple
    if (['c', 'g', 'k', 'q', 'w'].includes(firstLetter)) return 'c'; // pink
    return 'u'; // default teal
  };

  const getTypingText = () => {
    if (typingUsers.length === 0) return '';
    if (typingUsers.length === 1) return `${typingUsers[0].userName} is typing...`;
    if (typingUsers.length === 2) return `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
    return 'Several people are typing...';
  };

  if (loading) {
    return (
      <div className="main-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', animation: 'pulseText 1s infinite' }}>⚖️</div>
          <p style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const youOwe = data.debtsSummary.filter(d => d.status === 'owe');
  const youAreOwed = data.debtsSummary.filter(d => d.status === 'owed');
  const totalOutstanding = data.oweAmount + data.owedAmount;

  return (
    <div className="main-content">
      {/* Toast Notification */}
      {toast.show && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span className="toast-text">
              {toast.type === 'success' ? '✅' : '❌'} {toast.message}
            </span>
            <button className="toast-close" onClick={() => setToast({ show: false, message: '', type: '' })}>×</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Welcome to your shared balances summary sheet.</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchDashboardData} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
          🔄 Refresh stats
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Onboarding / Empty Dashboard Seeding Card */}
      {data.groups.length === 0 && (
        <div className="seed-banner">
          <div className="seed-banner-title">✨ Welcome to Splitwise!</div>
          <p className="seed-banner-desc">
            Your dashboard looks empty. Would you like us to seed some high-quality mock data? 
            This will instantly populate <strong>1 Group ("Road Trip 2026")</strong>, 
            adds <strong>3 members (Alice, Bob, Charlie)</strong>, logs <strong>4 distinct expense types</strong>, 
            a settlement payment, and creates chat comments so you can explore the app immediately.
          </p>
          <button 
            onClick={handleSeedDemoData} 
            className="btn btn-primary" 
            disabled={seeding}
            style={{ padding: '0.75rem 2rem' }}
          >
            {seeding ? 'Seeding Sample Data...' : '🚀 Seed Demo Data'}
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="dashboard-summary-cards">
        <div className="summary-card" style={{ borderLeft: '5px solid var(--primary)' }}>
          <span className="summary-card-title">Total net balance</span>
          <span className={`summary-card-value ${data.netBalance > 0 ? 'positive' : data.netBalance < 0 ? 'negative' : 'neutral'}`}>
            {data.netBalance > 0 ? `+$${data.netBalance.toFixed(2)}` : data.netBalance < 0 ? `-$${Math.abs(data.netBalance).toFixed(2)}` : '$0.00'}
          </span>
        </div>
        <div className="summary-card" style={{ borderLeft: '5px solid var(--accent-red)' }}>
          <span className="summary-card-title">you owe overall</span>
          <span className="summary-card-value negative">
            ${data.oweAmount.toFixed(2)}
          </span>
        </div>
        <div className="summary-card" style={{ borderLeft: '5px solid var(--accent-green)' }}>
          <span className="summary-card-title">you are owed overall</span>
          <span className="summary-card-value positive">
            ${data.owedAmount.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Column: Groups & Live Chat */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">My Groups</h3>
            </div>
            {data.groups.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📁</p>
                <p style={{ fontWeight: 600 }}>No active groups</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Click the "+" next to Groups in the sidebar to start a new shared ledger.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.groups.map(g => (
                  <Link 
                    key={g.id} 
                    to={`/group/${g.id}`} 
                    className="expense-item" 
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <div className="expense-item-left">
                      <div className="expense-date-badge" style={{ padding: '0.6rem', backgroundColor: 'var(--primary-light)' }}>
                        <span style={{ fontSize: '1.2rem' }}>📁</span>
                      </div>
                      <div className="expense-info">
                        <span className="expense-desc">{g.name}</span>
                        <span className="expense-payer">Group Ledger</span>
                      </div>
                    </div>
                    <div className="expense-item-right">
                      <div className="expense-personal">
                        <span className="expense-personal-label">Group balance</span>
                        <div className={`expense-personal-val ${g.netBalance > 0 ? 'owed' : g.netBalance < 0 ? 'owe' : 'none'}`}>
                          {g.netBalance > 0 ? `you are owed $${g.netBalance.toFixed(2)}` : g.netBalance < 0 ? `you owe $${Math.abs(g.netBalance).toFixed(2)}` : 'settled up'}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Interactive Live Discussion Board */}
          <div className="chat-container" style={{ height: '380px', marginTop: '1.5rem' }}>
            <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                💬 Live Group Chat
              </span>
              {expenses.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Discussing:</span>
                  <select 
                    value={selectedExpenseId} 
                    onChange={(e) => setSelectedExpenseId(e.target.value)}
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid var(--surface-border)',
                      fontSize: '0.75rem',
                      background: 'var(--surface)',
                      color: 'var(--text-main)',
                      outline: 'none',
                      cursor: 'pointer',
                      maxWidth: '185px'
                    }}
                  >
                    {expenses.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.description} (${parseFloat(e.amount).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            {expenses.length === 0 ? (
              <div className="chat-messages-feed" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</p>
                  <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>No active discussions</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.2rem' }}>Import a CSV or seed demo data to enable real-time messaging here.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="chat-messages-feed" style={{ padding: '0.75rem' }}>
                  {messages.length === 0 ? (
                    <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', padding: '1rem 0' }}>
                      <p style={{ fontSize: '1.2rem' }}>💬</p>
                      <p style={{ fontSize: '0.8rem' }}>No messages in this chat yet.</p>
                      <p style={{ fontSize: '0.7rem' }}>Send a message to start the real-time discussion!</p>
                    </div>
                  ) : (
                    messages.map(m => {
                      const isOutgoing = m.user_id === currentUser?.id;
                      return (
                        <div 
                          key={m.id} 
                          className={`chat-message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
                        >
                          <div className={`avatar ${isOutgoing ? 'u' : getAvatarColorClass(m.user_name)}`}>
                            {m.user_name ? m.user_name.charAt(0) : 'U'}
                          </div>
                          <div className={`chat-message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                            {!isOutgoing && <div className="chat-message-sender">{m.user_name}</div>}
                            <div>{m.message}</div>
                            <div className="chat-message-time">
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <div style={{ padding: '0.25rem 0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: 'var(--surface-hover)', fontStyle: 'italic', borderTop: '1px solid var(--surface-border)' }}>
                    {getTypingText()}
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="chat-input-area" style={{ padding: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="chat-input" 
                    placeholder="Write a message..." 
                    value={newMessage}
                    onChange={handleInputChange}
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    required
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
                    Send
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Debts Summary */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Outstanding Debts</h3>
            </div>
            
            {data.debtsSummary.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎉</p>
                <p style={{ fontWeight: 600 }}>You are all settled up!</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>No outstanding debts with any group members.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Visual balance progress bars */}
                <div>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.5px', marginBottom: '0.75rem' }}>Volume Breakdown</h4>
                  {data.debtsSummary.map(d => {
                    const pct = totalOutstanding > 0 ? ((d.amount / totalOutstanding) * 100) : 0;
                    return (
                      <div key={d.userId} className="visual-chart-container" style={{ marginBottom: '0.75rem' }}>
                        <div className="chart-label-row">
                          <span>{d.userName}</span>
                          <span style={{ color: d.status === 'owe' ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                            {d.status === 'owe' ? 'you owe' : 'owes you'} ${d.amount.toFixed(2)} ({pct.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="chart-bar-outer">
                          <div 
                            className={`chart-bar-inner ${d.status === 'owe' ? 'red' : 'green'}`} 
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid var(--surface-border)' }} />

                {/* You Owe Details */}
                {youOwe.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent-red)', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>You Owe</h4>
                    <ul className="debts-list">
                      {youOwe.map(d => (
                        <li key={d.userId} className="debt-item owe">
                          <div>
                            <span className="debt-user">{d.userName}</span>
                            <div className="debt-desc">consolidated balance</div>
                          </div>
                          <span className="debt-amount">${d.amount.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* You Are Owed Details */}
                {youAreOwed.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--accent-green)', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>You Are Owed</h4>
                    <ul className="debts-list">
                      {youAreOwed.map(d => (
                        <li key={d.userId} className="debt-item owed">
                          <div>
                            <span className="debt-user">{d.userName}</span>
                            <div className="debt-desc">owes you</div>
                          </div>
                          <span className="debt-amount">${d.amount.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
