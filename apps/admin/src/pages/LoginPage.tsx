import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import Icon from '../components/Icon';
import type { Staff } from '../types';
import './LoginPage.css';

interface LoginResponse {
  success: boolean;
  user?: Staff;
  error?: { message?: string };
}

interface LoginLocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAccessHelp, setShowAccessHelp] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as LoginLocationState | null)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post<LoginResponse>('/api/auth/login', {
        identifier: identifier.trim(),
        password,
      });
      if (res.success && res.user) {
        login(res.user);
        navigate('/dashboard');
      } else {
        setError(res.error?.message || 'Invalid email/username or password.');
      }
    } catch (err: unknown) {
      const message =
        typeof err === 'object' && err !== null && 'message' in err &&
        typeof err.message === 'string'
          ? err.message
          : 'Unable to sign in. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-layout__background"></div>
      <div className="login-layout__overlay"></div>
      
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-card__brand">
            <img 
              src="/assets/sona-logo.png?v=4" 
              alt="SONA College of Technology" 
              className="login-card__logo" 
            />
            <h1 className="login-card__title">SONA SMART ATTENDANCE</h1>
            <h2 className="login-card__subtitle">Admin Portal</h2>
            <p className="login-card__desc">Sign in with your administrator account</p>
          </div>

          <form onSubmit={handleLogin} className="login-form" aria-describedby={error ? 'login-error' : undefined}>
            {error && <div className="login-error" id="login-error" role="alert" aria-live="polite">{error}</div>}

            <div className="form-group">
              <label htmlFor="identifier">College email or staff code</label>
              <div className="input-with-icon">
                <Icon name="user" size={18} className="input-icon" />
                <input
                  id="identifier"
                  type="text"
                  name="identifier"
                  placeholder="Enter your college email or staff code"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                <Icon name="lock" size={18} className="input-icon" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  disabled={loading}
                />
                <button 
                  type="button" 
                  className="password-toggle" 
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                >
                  <Icon name={showPassword ? "view-off" : "view"} size={18} />
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading || !identifier.trim() || !password} aria-busy={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="login-access">
            <button
              type="button"
              className="login-access__trigger"
              aria-expanded={showAccessHelp}
              aria-controls="login-access-help"
              onClick={() => setShowAccessHelp((visible) => !visible)}
            >
              Need access to the portal?
            </button>
            {showAccessHelp && (
              <p className="login-access__message" id="login-access-help">
                Admin accounts are created by your institution. Contact your department administrator to request access.
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="login-footer">
        © {new Date().getFullYear()} SONA COLLEGE OF TECHNOLOGY. All Rights Reserved
      </footer>
    </div>
  );
}
