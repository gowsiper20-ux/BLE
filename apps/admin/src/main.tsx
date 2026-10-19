import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './config/msalConfig';
import './index.css';
import App from './App';

msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().catch((err) => {
    console.error('MSAL redirect handling error:', err);
  });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  );
}).catch((err) => {
  console.error('Failed to initialize MSAL instance:', err);
  // Fallback render without breaking entire app
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
