import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { isMsalConfigured } from '../config/msalConfig';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import type { Staff } from '../types';
import './LoginPage.css';

interface LoginResponse {
  success: boolean;
  user?: Staff;
  token?: string;
  error?: { message?: string };
}

interface LoginLocationState {
  from?: { pathname?: string };
}

const VERIFIED_COLLEGE_ACCOUNTS = [
  {
    name: 'System Administrator',
    email: 'admin@sonatech.ac.in',
    role: 'ADMIN',
    badge: 'Administrator',
    icon: '👑',
  },
  {
    name: 'Dr. J. Akilandeswari',
    email: 'hod.it@sonatech.ac.in',
    role: 'HOD',
    badge: 'Head of Department',
    icon: '🎓',
  },
  {
    name: 'Dr. M. Suresh',
    email: 'suresh.it@sonatech.ac.in',
    role: 'DEPUTY_HOD',
    badge: 'Deputy HOD',
    icon: '👨‍🏫',
  },
  {
    name: 'Dr. P. Kavitha',
    email: 'kavitha.it@sonatech.ac.in',
    role: 'CLASS_COUNSELOR',
    badge: 'Class Counselor (II IT-A)',
    icon: '👩‍🏫',
  },
  {
    name: 'Dr. S. Senthilkumar',
    email: 'senthilkumar.it@sonatech.ac.in',
    role: 'CLASS_COUNSELOR',
    badge: 'Class Counselor (II IT-B)',
    icon: '👨‍🏫',
  },
  {
    name: 'Dr. R. Priya',
    email: 'priya.it@sonatech.ac.in',
    role: 'CLASS_COUNSELOR',
    badge: 'Class Counselor (III IT-A)',
    icon: '👩‍🏫',
  },
  {
    name: 'Prof. K. Ramesh',
    email: 'ramesh.it@sonatech.ac.in',
    role: 'STAFF',
    badge: 'Faculty Member',
    icon: '👨‍🏫',
  },
];

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAccessHelp, setShowAccessHelp] = useState(false);
  const [showCollegeAccountModal, setShowCollegeAccountModal] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithMicrosoft, loginWithCollegeAccount, isAuthenticated } = useAuth();

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
        login(res.user, res.token);
        const from = (location.state as LoginLocationState | null)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
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

  const handleMicrosoftLogin = async () => {
    setError('');
    // If real Azure App Registration Client ID is provided in .env, use real MSAL cloud popup
    if (isMsalConfigured()) {
      setMsLoading(true);
      try {
        const res = await loginWithMicrosoft();
        if (res.success) {
          const from = (location.state as LoginLocationState | null)?.from?.pathname || '/dashboard';
          navigate(from, { replace: true });
        } else {
          setError(res.error || 'Microsoft authentication failed.');
        }
      } catch (err: any) {
        setError(err?.message || 'Unable to sign in with Microsoft. Please try again.');
      } finally {
        setMsLoading(false);
      }
    } else {
      // In development / college project mode without an external Azure tenant app,
      // open the college account chooser modal to select any verified Sona Tech account
      setShowCollegeAccountModal(true);
    }
  };

  const handleSelectCollegeAccount = async (email: string, name?: string) => {
    setModalLoading(true);
    setModalError('');
    try {
      const res = await loginWithCollegeAccount(email, name);
      if (res.success) {
        setShowCollegeAccountModal(false);
        const from = (location.state as LoginLocationState | null)?.from?.pathname || '/dashboard';
        navigate(from, { replace: true });
      } else {
        setModalError(res.error || 'Sign-in failed.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Authentication error.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCustomEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    if (!customEmail.toLowerCase().endsWith('@sonatech.ac.in')) {
      setModalError('Account must belong to the college domain (@sonatech.ac.in).');
      return;
    }
    await handleSelectCollegeAccount(customEmail.trim().toLowerCase());
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

          {error && <div className="login-error" id="login-error" role="alert" aria-live="polite">{error}</div>}

          <button
            type="button"
            className="microsoft-btn"
            onClick={handleMicrosoftLogin}
            disabled={loading || msLoading}
            aria-busy={msLoading}
            style={{ marginTop: error ? '16px' : '0' }}
          >
            <svg className="microsoft-icon-svg" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            <span>{msLoading ? 'Connecting to Microsoft…' : 'Sign in with College Account (@sonatech.ac.in)'}</span>
          </button>

          <div className="login-divider">
            <span>or sign in with password</span>
          </div>

          <form onSubmit={handleLogin} className="login-form" aria-describedby={error ? 'login-error' : undefined}>
            <div className="form-group">
              <label htmlFor="identifier">College email or staff code</label>
              <div className="input-with-icon">
                <Icon name="user" size={18} className="input-icon" />
                <input
                  id="identifier"
                  type="text"
                  name="identifier"
                  placeholder="admin@sonatech.ac.in or ADM-001"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (error) setError('');
                  }}
                  required
                  disabled={loading || msLoading}
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
                  disabled={loading || msLoading}
                />
                <button 
                  type="button" 
                  className="password-toggle" 
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading || msLoading}
                >
                  <Icon name={showPassword ? "view-off" : "view"} size={18} />
                </button>
              </div>
            </div>

            {/* Quick Demo Credentials Pill Bar */}
            <div className="quick-credentials">
              <span className="quick-credentials__label">Demo Credentials:</span>
              <button
                type="button"
                className="quick-cred-pill"
                onClick={() => {
                  setIdentifier('admin@sonatech.ac.in');
                  setPassword('Admin@123');
                  setError('');
                }}
              >
                👑 Admin
              </button>
              <button
                type="button"
                className="quick-cred-pill"
                onClick={() => {
                  setIdentifier('hod.it@sonatech.ac.in');
                  setPassword('Admin@123');
                  setError('');
                }}
              >
                🎓 HOD
              </button>
              <button
                type="button"
                className="quick-cred-pill"
                onClick={() => {
                  setIdentifier('admin@college.edu');
                  setPassword('Admin@123');
                  setError('');
                }}
              >
                🔑 Legacy Admin
              </button>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={loading || msLoading || !identifier.trim() || !password}
              aria-busy={loading}
            >
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
                Admin accounts are created by your institution. All faculty and students of Sona College of Technology can access the portal using their official <strong>@sonatech.ac.in</strong> account.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* College Account / Microsoft Entra ID Sign-In Modal */}
      <Modal
        isOpen={showCollegeAccountModal}
        onClose={() => {
          if (!modalLoading) {
            setShowCollegeAccountModal(false);
            setModalError('');
          }
        }}
        title="Microsoft Entra ID — Sona College of Technology"
        size="md"
      >
        <div className="entra-modal">
          <div className="entra-modal__header">
            <svg className="microsoft-icon-svg" viewBox="0 0 21 21" style={{ width: 24, height: 24 }}>
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Select your college account</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Department of Information Technology (@sonatech.ac.in)</div>
            </div>
          </div>

          {modalError && (
            <div className="login-error" style={{ marginBottom: 16 }}>
              {modalError}
            </div>
          )}

          <div className="entra-accounts-list">
            {VERIFIED_COLLEGE_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                className="entra-account-item"
                disabled={modalLoading}
                onClick={() => handleSelectCollegeAccount(acc.email, acc.name)}
              >
                <span className="entra-account-icon">{acc.icon}</span>
                <div className="entra-account-info">
                  <div className="entra-account-name">{acc.name}</div>
                  <div className="entra-account-email">{acc.email}</div>
                </div>
                <span className="entra-account-badge">{acc.badge}</span>
              </button>
            ))}
          </div>

          <div className="login-divider" style={{ margin: '16px 0' }}>
            <span>or use another account</span>
          </div>

          <form onSubmit={handleCustomEmailLogin} style={{ display: 'flex', gap: 8 }}>
            <input
              type="email"
              placeholder="e.g. yourname@sonatech.ac.in"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              disabled={modalLoading}
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            />
            <button
              type="submit"
              disabled={modalLoading || !customEmail.trim()}
              className="login-btn"
              style={{ width: 'auto', padding: '10px 18px', whiteSpace: 'nowrap' }}
            >
              {modalLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="entra-setup-note">
            💡 <strong>Azure Cloud Integration:</strong> To connect directly to Microsoft's live online OAuth popup (portal.azure.com), add your registered <code>VITE_MSAL_CLIENT_ID</code> in <code>apps/admin/.env</code>.
          </div>
        </div>
      </Modal>

      <footer className="login-footer">
        © {new Date().getFullYear()} SONA COLLEGE OF TECHNOLOGY. All Rights Reserved
      </footer>
    </div>
  );
}

