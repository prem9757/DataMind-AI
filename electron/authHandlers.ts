import { ipcMain, BrowserWindow } from 'electron';
import { safeStorage } from 'electron';

export function registerAuthHandlers() {
  ipcMain.handle('auth:oauth', async (_, { provider, config }) => {
    return new Promise((resolve) => {
      let authUrl = '';
      let redirectUri = 'http://localhost/callback';
      
      if (provider === 'Microsoft') {
        const tenant = config.tenantId || 'common';
        const clientId = config.clientId || 'YOUR_DEFAULT_CLIENT_ID'; // In real app, must be provided
        authUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=User.Read%20offline_access`;
      } else if (provider === 'Google') {
        const clientId = config.clientId;
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=https://www.googleapis.com/auth/analytics.readonly`;
      } else if (provider === 'Salesforce') {
        const clientId = config.clientId;
        const env = config.environment === 'sandbox' ? 'test' : 'login';
        authUrl = `https://${env}.salesforce.com/services/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token`;
      } else {
        return resolve({ status: 'error', message: 'Unsupported provider' });
      }

      const authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      });

      authWindow.loadURL(authUrl);

      const handleRedirect = (url: string) => {
        if (url.startsWith(redirectUri)) {
          authWindow.close();
          const hash = url.split('#')[1] || url.split('?')[1];
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          if (accessToken) {
            resolve({ status: 'success', token: accessToken });
          } else {
            resolve({ status: 'error', message: 'Authentication failed: No access token found.' });
          }
        }
      };

      authWindow.webContents.on('will-redirect', (event, url) => {
        handleRedirect(url);
      });
      
      authWindow.webContents.on('did-redirect-navigation', (event, url) => {
        handleRedirect(url);
      });

      authWindow.on('closed', () => {
        resolve({ status: 'error', message: 'Authentication cancelled by user.' });
      });
    });
  });
}
