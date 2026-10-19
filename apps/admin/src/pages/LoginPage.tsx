import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isMsalConfigured } from '../config/msalConfig';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

interface LoginLocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { loginWithMicrosoft, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as LoginLocationState | null)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, location, navigate]);

  const handleMicrosoftLogin = async () => {
    setError('');
    setLoading(true);
    const result = await loginWithMicrosoft();
    if (result.success) {
      const from = (location.state as LoginLocationState | null)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Microsoft authentication failed.');
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
            <h2 className="login-card__subtitle">Admin Portal</h2>
            <p className="login-card__desc">Sign in with your authorized Microsoft Entra account.</p>
          </div>

          {error && <div className="login-error" role="alert" aria-live="polite">{error}</div>}
          {!isMsalConfigured() && (
            <div className="login-error" role="alert">
              Microsoft sign-in is not configured. Set VITE_MSAL_TENANT_ID, VITE_MSAL_CLIENT_ID,
              VITE_MSAL_API_SCOPE, and VITE_MSAL_REDIRECT_URI for the registered SPA.
            </div>
          )}
          <button
            type="button"
            className="microsoft-btn"
            onClick={handleMicrosoftLogin}
            disabled={loading || !isMsalConfigured()}
            aria-busy={loading}
          >
            <svg className="microsoft-icon-svg" viewBox="0 0 21 21" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            <span>{loading ? 'Connecting to Microsoft…' : 'Sign in with Microsoft'}</span>
          </button>
          <div className="login-access">
            <p className="login-access__message">
              Access is granted only to accounts explicitly provisioned for this application.
              Contact your institution administrator if your account is not mapped.
            </p>
          </div>
        </div>
      </div>
      <footer className="login-footer">
        © {new Date().getFullYear()} SONA COLLEGE OF TECHNOLOGY. All Rights Reserved
      </footer>
    </div>
  );
}
