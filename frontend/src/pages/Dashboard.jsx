import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Link } from 'react-router-dom';

export default function Dashboard({ onSeed }) {
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

  // Split consolidated debts
  const youOwe = data.debtsSummary.filter(d => d.status === 'owe');
  const youAreOwed = data.debtsSummary.filter(d => d.status === 'owed');
  
  // Calculate total outstanding volume for the visual bars
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
        {/* Left Column: Groups */}
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
