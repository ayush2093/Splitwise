import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';

export default function ExpenseDetail() {
  const { id: expenseId } = useParams();
  const { user: currentUser, token } = useAuth();
  
  const [expense, setExpense] = useState(null);
  const [splits, setSplits] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Chat state
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  
  const socketRef = useRef(null);
  const feedEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fetch initial details
  const fetchDetails = async () => {
    try {
      const data = await api.get(`/expenses/${expenseId}`);
      setExpense(data.expense);
      setSplits(data.splits);
      setMessages(data.messages);
    } catch (err) {
      setError(err.message || 'Failed to load expense details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [expenseId]);

  // Establish WebSockets Connection for chat
  useEffect(() => {
    if (!expenseId || !token) return;

    // Connect to WebSocket server
    const socketUrl = api.getBackendUrl();
    const socket = io(socketUrl, {
      auth: { token },
      extraHeaders: {
        'Bypass-Tunnel-Reminder': 'true'
      }
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to chat server');
      socket.emit('join_expense', parseInt(expenseId));
    });

    socket.on('receive_message', (payload) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === payload.id)) return prev;
        return [...prev, payload];
      });
      // Remove sender from typing list
      setTypingUsers((prev) => prev.filter(u => u.userId !== payload.user_id));
    });

    // Handle typing events
    socket.on('user_typing', (data) => {
      setTypingUsers((prev) => {
        if (prev.some(u => u.userId === data.userId)) return prev;
        return [...prev, data];
      });
    });

    socket.on('user_stop_typing', (data) => {
      setTypingUsers((prev) => prev.filter(u => u.userId !== data.userId));
    });

    socket.on('error_message', (data) => {
      alert(data.error || 'Chat server error');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from chat server');
    });

    // Fallback polling for serverless (Vercel) environments where sockets are not persistent
    const pollingInterval = setInterval(async () => {
      try {
        const data = await api.get(`/expenses/${expenseId}`);
        setMessages((prev) => {
          const merged = [...prev];
          (data.messages || []).forEach(newMsg => {
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

    // Cleanup on unmount
    return () => {
      clearInterval(pollingInterval);
      if (socket) {
        socket.emit('leave_expense', parseInt(expenseId));
        socket.disconnect();
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [expenseId, token]);

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUsers]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    if (socketRef.current) {
      // Send typing notice
      socketRef.current.emit('typing', { expenseId: parseInt(expenseId) });

      // Reset debounce timeout
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('stop_typing', { expenseId: parseInt(expenseId) });
      }, 1500);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const msgText = newMessage.trim();
    setNewMessage('');

    // Stop typing immediately
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (socketRef.current) {
      socketRef.current.emit('stop_typing', { expenseId: parseInt(expenseId) });
    }

    try {
      // Always send messages via HTTP POST to guarantee DB save in serverless env
      const res = await api.post(`/expenses/${expenseId}/messages`, { message: msgText });
      
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

  const getSplitLabel = (s) => {
    if (expense.split_type === 'percentage') {
      return `${s.percentage}%`;
    }
    if (expense.split_type === 'share') {
      return `${s.share} share(s)`;
    }
    if (expense.split_type === 'unequal') {
      return 'Exact amount';
    }
    return 'Equal share';
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <div style={{ fontSize: '2.5rem', animation: 'pulseText 1s infinite' }}>💬</div>
          <p style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Loading expense details...</p>
        </div>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="main-content">
        <div className="error-banner">{error || 'Expense not found.'}</div>
        <Link to="/" className="btn btn-secondary">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="main-content">
      <div className="expense-detail-header">
        <Link to={`/group/${expense.group_id}`} className="btn btn-link" style={{ marginBottom: '1rem', display: 'inline-flex' }}>
          ← Back to {expense.group_name}
        </Link>
        <h2 className="expense-detail-desc">{expense.description}</h2>
        <div className="expense-detail-meta">
          Paid by <strong>{expense.paid_by === currentUser.id ? 'you' : expense.paid_by_name}</strong> on {new Date(expense.date).toLocaleDateString()}
        </div>
      </div>

      <div className="expense-detail-layout">
        {/* Left Column: Splits information */}
        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Expense Splits</h3>
            </div>
            
            <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--surface-hover)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Bill</span>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)' }}>
                ${parseFloat(expense.amount).toFixed(2)}
              </div>
              <span style={{ fontSize: '0.8rem', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', fontWeight: 600 }}>
                Split {expense.split_type}
              </span>
            </div>

            <div className="split-breakdown-list">
              {splits.map(s => (
                <div key={s.id} className="split-breakdown-item">
                  <div>
                    <span className="split-breakdown-user">
                      {s.user_name} {s.user_id === currentUser.id && '(you)'}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Ratio: {getSplitLabel(s)}
                    </div>
                  </div>
                  <span className="split-breakdown-amount">${parseFloat(s.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Real-time comments */}
        <div>
          <div className="chat-container">
            <div className="chat-header">
              💬 Expense Chat (Real-time)
            </div>
            
            <div className="chat-messages-feed">
              {messages.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '1.5rem' }}>💬</p>
                  <p style={{ fontSize: '0.85rem' }}>No messages in this chat yet.</p>
                  <p style={{ fontSize: '0.75rem' }}>Say something to start the conversation!</p>
                </div>
              ) : (
                messages.map(m => {
                  const isOutgoing = m.user_id === currentUser.id;
                  return (
                    <div 
                      key={m.id} 
                      className={`chat-message-row ${isOutgoing ? 'outgoing' : 'incoming'}`}
                    >
                      <div className={`avatar ${isOutgoing ? 'u' : getAvatarColorClass(m.user_name)}`}>
                        {m.user_name.charAt(0)}
                      </div>
                      <div className={`chat-message-bubble ${isOutgoing ? 'outgoing' : 'incoming'}`}>
                        {!isOutgoing && <div className="chat-message-sender">{m.user_name}</div>}
                        <div>{m.message}</div>
                        <div className="chat-message-time" title={formatDate(m.created_at)}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={feedEndRef} />
            </div>

            {/* Typing Indicator Bar */}
            <div className="typing-indicator-container">
              {getTypingText()}
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-area">
              <input 
                type="text" 
                className="chat-input" 
                placeholder="Write a message..." 
                value={newMessage}
                onChange={handleInputChange}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
