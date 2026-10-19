import type { Configuration } from '@azure/msal-browser';
import { PublicClientApplication } from '@azure/msal-browser';

const tenantId = import.meta.env.VITE_MSAL_TENANT_ID || 'common';
const clientId = import.meta.env.VITE_MSAL_CLIENT_ID || '00000000-0000-0000-0000-000000000000';
const authority = import.meta.env.VITE_MSAL_AUTHORITY || `https://login.microsoftonline.com/${tenantId}`;
const redirectUri = import.meta.env.VITE_MSAL_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority,
    redirectUri,
    postLogoutRedirectUri: redirectUri,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

// Configured scopes for Entra ID token acquisition
export const loginRequest = {
  scopes: [
    'openid',
    'profile',
    'email',
    ...(import.meta.env.VITE_MSAL_API_SCOPE ? [import.meta.env.VITE_MSAL_API_SCOPE] : []),
  ],
};

// Singleton PublicClientApplication
export const msalInstance = new PublicClientApplication(msalConfig);

export const isMsalConfigured = (): boolean => {
  const cid = import.meta.env.VITE_MSAL_CLIENT_ID;
  return Boolean(
    cid &&
    cid !== '00000000-0000-0000-0000-000000000000' &&
    cid !== 'YOUR_MICROSOFT_CLIENT_ID'
  );
};

