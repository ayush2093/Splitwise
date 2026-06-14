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
          <span>💡</span> Evaluation Demo Accounts
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.4' }}>
          To test real-time chat, typing indicators, and settlements, log in on another window (Incognito) as one of these members (Password: <strong>password123</strong>):
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem', fontFamily: 'monospace', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed rgba(26, 188, 138, 0.15)' }}>
            <strong>aisha@example.com</strong>
            <span>(Aisha - Simplified Debts)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed rgba(26, 188, 138, 0.15)' }}>
            <strong>rohan@example.com</strong>
            <span>(Rohan - Itemized Ledger)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed rgba(26, 188, 138, 0.15)' }}>
            <strong>priya@example.com</strong>
            <span>(Priya - Currency USD)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed rgba(26, 188, 138, 0.15)' }}>
            <strong>sam@example.com</strong>
            <span>(Sam - Joined Mid-April)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
            <strong>meera@example.com</strong>
            <span>(Meera - Duplicate Checker)</span>
          </div>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.4' }}>
          *Note: These flatmate accounts are automatically generated and linked to the group database as soon as you import the <strong>expenses_export.csv</strong> file on the Import page.
        </p>
      </div>
    </div>
  );
}
