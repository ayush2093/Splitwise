import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const isExpired = new URLSearchParams(window.location.search).get('expired') === 'true';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail) => {
    setError('');
    setLoading(true);
    setEmail(demoEmail);
    setPassword('password123');
    try {
      await login(demoEmail, 'password123');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">Split<span>wise</span></div>
          <p className="auth-subtitle">Welcome back! Please login to continue.</p>
        </div>

        {isExpired && !error && (
          <div className="error-banner" style={{ backgroundColor: '#fff9db', borderColor: '#ffc107', color: '#856404' }}>
            ⚠️ Your session has expired. Please log in again.
          </div>
        )}

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email" 
              className="form-input" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? 'text' : 'password'} 
                id="password" 
                className="form-input" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '2.5rem' }}
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.2rem' }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>

      {/* Demo Credentials Panel */}
      <div className="auth-card" style={{ padding: '1.5rem 2rem', marginTop: 0, width: '100%', maxWidth: '440px', backgroundColor: 'var(--primary-light)', borderColor: 'rgba(26, 188, 138, 0.2)' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary-hover)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>💡</span> Evaluation Quick Login
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
          Click any button below to instantly log in as that flatmate (Default Password: <code>password123</code>) to inspect live reports, ledgers, and real-time chat:
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {[
            { email: 'aisha@example.com', name: 'Aisha', label: 'Simplified Balances' },
            { email: 'rohan@example.com', name: 'Rohan', label: 'Itemized Ledger' },
            { email: 'priya@example.com', name: 'Priya', label: 'Currency (USD/INR)' },
            { email: 'sam@example.com', name: 'Sam', label: 'Timeline Active Member' },
            { email: 'meera@example.com', name: 'Meera', label: 'Duplicate / Anomaly Resolver' }
          ].map((user) => (
            <button
              key={user.email}
              type="button"
              onClick={() => handleQuickLogin(user.email)}
              disabled={loading}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 0.8rem',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                border: '1px solid rgba(26, 188, 138, 0.15)',
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--white)';
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
                e.currentTarget.style.borderColor = 'rgba(26, 188, 138, 0.15)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)' }}>{user.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{user.email}</span>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', backgroundColor: 'var(--primary-light)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                {user.label}
              </span>
            </button>
          ))}
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.4' }}>
          *Note: These accounts represent the flatmates pre-seeded directly from the exported CSV.
        </p>
      </div>
    </div>
  );
}
