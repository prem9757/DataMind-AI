import { Connector } from '../types';
import { desktopBridge } from '../../services/desktopBridge';

const createOAuthCloudConnector = (id: string, name: string, provider: 'Microsoft' | 'Google' | 'Salesforce'): Connector => ({
  id,
  name,
  category: 'cloud',
  description: `Connect to ${name} via ${provider} OAuth.`,
  icon: 'Cloud',
  requiresAuthentication: true,
  configFields: [
    { id: 'tenantId', label: 'Tenant ID (Optional)', type: 'text', required: false, placeholder: 'common' },
    { id: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'Your OAuth Client ID' },
    { id: 'environment', label: 'Environment (Salesforce Only)', type: 'select', required: false, options: [{label: 'Production', value: 'login'}, {label: 'Sandbox', value: 'sandbox'}] },
    { id: 'query', label: 'Resource URL or Query', type: 'text', required: true, placeholder: provider === 'Microsoft' ? 'https://graph.microsoft.com/v1.0/me/drive/root/children' : provider === 'Google' ? 'https://analyticsdata.googleapis.com/v1beta/properties/PROPERTY_ID:runReport' : 'https://your-instance.my.salesforce.com/services/data/v60.0/query/?q=SELECT+Id+FROM+Account' }
  ],
  testConnection: async (config) => {
    if (!config.accessToken) {
      return { status: 'error', message: `OAuth 2.0 flow required for ${provider}. Please Authenticate via Connection Manager.` };
    }
    
    try {
      let testUrl = '';
      if (provider === 'Microsoft') testUrl = 'https://graph.microsoft.com/v1.0/me';
      else if (provider === 'Google') testUrl = 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json';
      else if (provider === 'Salesforce') {
        const env = config.environment === 'sandbox' ? 'test' : 'login';
        testUrl = `https://${env}.salesforce.com/services/oauth2/userinfo`;
      }
      
      const response = await desktopBridge.web.fetchRest({
        url: testUrl,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`
        }
      });
      
      if (response && (response.id || response.user_id || response.sub || response.email)) {
        return { status: 'success', message: 'OAuth Authentication successful.' };
      }
      return { status: 'success', message: 'Connected, but unexpected response format.' };
    } catch (e: any) {
      return { status: 'error', message: e.message || 'Token expired or invalid.' };
    }
  },
  preview: async (config) => {
    if (!config.accessToken) throw new Error(`Authentication required for ${provider}.`);
    
    const response = await desktopBridge.web.fetchRest({
      url: config.query,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    let targetData = response.value || response.data || response.records || response;
    if (!Array.isArray(targetData)) {
      if (typeof targetData === 'object' && targetData !== null) {
        targetData = [targetData];
      } else {
        throw new Error('Fetched data is not tabular (array or object).');
      }
    }
    
    const rows = targetData.slice(0, 100);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    
    return {
      columns,
      rows,
      rowCount: targetData.length,
      columnCount: columns.length
    };
  },
  import: async (config) => {
    if (!config.accessToken) throw new Error(`Authentication required for ${provider}.`);
    
    const response = await desktopBridge.web.fetchRest({
      url: config.query,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    let targetData = response.value || response.data || response.records || response;
    if (!Array.isArray(targetData)) {
      if (typeof targetData === 'object' && targetData !== null) {
        targetData = [targetData];
      } else {
        throw new Error('Fetched data is not tabular (array or object).');
      }
    }
    
    const columns = targetData.length > 0 ? Object.keys(targetData[0]) : [];
    
    return {
      columns,
      rows: targetData
    };
  }
});

export const sharepointConnector = createOAuthCloudConnector('cloud-sharepoint', 'SharePoint', 'Microsoft');
export const onedriveConnector = createOAuthCloudConnector('cloud-onedrive', 'OneDrive', 'Microsoft');
export const azureConnector = createOAuthCloudConnector('cloud-azure', 'Azure Data Lake', 'Microsoft');
export const googleDriveConnector = createOAuthCloudConnector('cloud-gdrive', 'Google Drive', 'Google');
export const googleAnalyticsConnector = createOAuthCloudConnector('cloud-ga', 'Google Analytics', 'Google');
export const salesforceConnector = createOAuthCloudConnector('cloud-salesforce', 'Salesforce', 'Salesforce');
export const dynamics365Connector = createOAuthCloudConnector('cloud-dynamics', 'Dynamics 365', 'Microsoft');
