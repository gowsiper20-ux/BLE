import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import './LoginPage.css';

interface LoginLocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [signupEnabled, setSignupEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup, isAuthenticated } = useAuth();

  useEffect(() => {
    let active = true;
    void api.get<{ enabled: boolean }>('/api/auth/signup-status')
      .then((response) => {
        if (active) setSignupEnabled(response.enabled);
      })
      .catch(() => {
        if (active) setSignupEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const requested = (location.state as LoginLocationState | null)?.from?.pathname;
      navigate(requested || '/dashboard', { replace: true });
    }
  }, [isAuthenticated, location, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const result = isSignUp
      ? await signup(name, email, password)
      : await login(email, password);
    if (result.success) {
      navigate((location.state as LoginLocationState | null)?.from?.pathname || '/dashboard', { replace: true });
    } else {
      setError(result.error || 'Invalid email or password.');
    }
    setLoading(false);
  };

  return (
    <div className="login-layout">
      <div className="login-layout__background" />
      <div className="login-layout__overlay" />
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-card__brand">
            <img src="/assets/sona-logo.png?v=4" alt="SONA College of Technology" className="login-card__logo" />
            <h1 className="login-card__title">SONA SMART ATTENDANCE</h1>
            <h2 className="login-card__subtitle">HOD &amp; Faculty Portal</h2>
            <p className="login-card__desc">
              {isSignUp ? 'Create a faculty account.' : 'Sign in with your staff or HOD account.'}
            </p>
          </div>

          {error && <div className="login-error" role="alert" aria-live="polite">{error}</div>}
          <form className="login-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="form-group">
                <label htmlFor="admin-name">Full name</label>
                <div className="input-with-icon">
                  <input
                    id="admin-name"
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={255}
                    minLength={2}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="admin-email">Email address</label>
              <div className="input-with-icon">
                <input
                  id="admin-email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={254}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="admin-password">Password</label>
              <div className="input-with-icon">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  maxLength={72}
                  minLength={isSignUp ? 12 : undefined}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  disabled={loading}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {isSignUp && (
              <div className="form-group">
                <label htmlFor="admin-confirm-password">Confirm password</label>
                <div className="input-with-icon">
                  <input
                    id="admin-confirm-password"
                    type="password"
                    name="confirm-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    maxLength={72}
                    minLength={12}
                    required
                    disabled={loading}
                  />
                </div>
              </div>
            )}
            <button type="submit" className="login-button" disabled={loading} aria-busy={loading}>
              {loading ? (isSignUp ? 'Creating account…' : 'Signing in…') : (isSignUp ? 'Sign Up' : 'Sign In')}
            </button>
          </form>
          {signupEnabled && (
            <button
              type="button"
              className="login-signup-toggle"
              onClick={() => {
                setIsSignUp((current) => !current);
                setError('');
              }}
              disabled={loading}
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          )}
        </div>
      </div>
      <footer className="login-footer">
        © {new Date().getFullYear()} SONA COLLEGE OF TECHNOLOGY. All Rights Reserved
      </footer>
    </div>
  );
}
