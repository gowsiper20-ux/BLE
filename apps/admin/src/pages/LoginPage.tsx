import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Icon from '../components/Icon';
import './LoginPage.css';

interface LoginLocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const [email, setEmail] = useState('hod.it@sonatech.ac.in');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const requested = (location.state as LoginLocationState | null)?.from?.pathname;
      navigate(requested || '/dashboard', { replace: true });
    }
  }, [isAuthenticated, location, navigate]);

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(email, password);
    if (result.success) {
      navigate((location.state as LoginLocationState | null)?.from?.pathname || '/dashboard', { replace: true });
    } else {
      setError(result.error || 'Invalid credentials. Please verify your email and password.');
    }
    setLoading(false);
  };

  return (
    <div className="login-layout">
      <div className="login-layout__background" />
      <div className="login-layout__overlay" />

      <div className="login-card-container">
        <div className="login-card">
          {/* Header & Logo */}
          <div className="login-card__brand">
            <div className="login-card__logo-row">
              <span className="login-card__crest-badge">SONA</span>
              <div className="login-card__brand-titles">
                <h1 className="login-card__title">SONA SMART ATTENDANCE</h1>
                <span className="login-card__subtitle">Department of Information Technology</span>
              </div>
            </div>
          </div>

          <div className="login-portal-badge login-portal-badge--hod" style={{ width: '100%', justifyContent: 'center', boxSizing: 'border-box' }}>
            <Icon name="lock" size={15} />
            <span>Head of Department (HOD) Portal</span>
          </div>

          {/* Errors or Notices */}
          {error && <div className="login-alert login-alert--error" role="alert">{error}</div>}

          {/* HOD Sign In Form */}
          <form className="login-form" onSubmit={handleLoginSubmit}>
            <div className="form-group">
              <label htmlFor="hod-email">HOD / Admin College Email</label>
              <input
                id="hod-email"
                type="email"
                value={email}
                placeholder="hod.it@sonatech.ac.in"
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="hod-password">Password</label>
              <div className="input-with-icon">
                <input
                  id="hod-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder="Enter executive password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Quick Assistant */}
            <div className="login-quick-helper">
              <span className="quick-helper-label">Quick Sign-in:</span>
              <button
                type="button"
                className="quick-helper-chip"
                onClick={() => {
                  setEmail('hod.it@sonatech.ac.in');
                  setPassword('123456789012');
                }}
              >
                Fill HOD (Dr. J. Akilandeswari)
              </button>
              <button
                type="button"
                className="quick-helper-chip"
                onClick={() => {
                  setEmail('admin@sonatech.ac.in');
                  setPassword('123456789012');
                }}
              >
                Fill Admin
              </button>
            </div>

            <button type="submit" className="login-btn login-btn--hod" disabled={loading}>
              {loading ? 'Authenticating...' : 'Sign In to HOD Dashboard'}
            </button>
          </form>

          {/* Footer note */}
          <div className="login-card__footer">
            <span>Sona College of Technology (Autonomous), Salem · HOD Oversight Portal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
