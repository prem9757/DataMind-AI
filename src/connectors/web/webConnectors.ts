import { Connector } from '../types';
import { desktopBridge } from '../../services/desktopBridge';

const getByPath = (obj: any, path: string) => {
  if (!path) return obj;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const restApiConnector: Connector = {
  id: 'web-rest',
  name: 'REST API',
  category: 'web',
  description: 'Fetch data from a REST API endpoint.',
  icon: 'Globe',
  configFields: [
    { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/data' },
    { id: 'method', label: 'HTTP Method', type: 'select', required: true, defaultValue: 'GET', options: [{label: 'GET', value: 'GET'}, {label: 'POST', value: 'POST'}] },
    { id: 'headers', label: 'Headers (JSON)', type: 'text', placeholder: '{"Authorization": "Bearer..."}' },
    { id: 'jsonPath', label: 'JSON Extraction Path', type: 'text', placeholder: 'e.g. data.results' }
  ],
  testConnection: async (config) => {
    try {
      const headers = config.headers ? JSON.parse(config.headers) : {};
      await desktopBridge.web.fetchRest({ url: config.url, method: config.method, headers });
      return { status: 'success', message: 'Connection successful.' };
    } catch (e: any) {
      return { status: 'error', message: e.message || 'Failed to connect.' };
    }
  },
  preview: async (config) => {
    const headers = config.headers ? JSON.parse(config.headers) : {};
    const rawData = await desktopBridge.web.fetchRest({ url: config.url, method: config.method, headers });
    
    let targetData = getByPath(rawData, config.jsonPath);
    if (!Array.isArray(targetData)) {
      if (typeof targetData === 'object' && targetData !== null) {
        targetData = [targetData]; // Wrap single object in array
      } else {
        throw new Error('Fetched data at path is not an array or object.');
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
    const headers = config.headers ? JSON.parse(config.headers) : {};
    const rawData = await desktopBridge.web.fetchRest({ url: config.url, method: config.method, headers });
    
    let targetData = getByPath(rawData, config.jsonPath);
    if (!Array.isArray(targetData)) {
      if (typeof targetData === 'object' && targetData !== null) {
        targetData = [targetData];
      } else {
        throw new Error('Fetched data at path is not an array or object.');
      }
    }
    
    const columns = targetData.length > 0 ? Object.keys(targetData[0]) : [];
    return {
      columns,
      rows: targetData
    };
  }
};

export const htmlTableConnector: Connector = {
  id: 'web-html-table',
  name: 'Web Page Tables',
  category: 'web',
  description: 'Extract HTML tables directly from a web page URL.',
  icon: 'Globe',
  configFields: [
    { id: 'url', label: 'Page URL', type: 'text', required: true, placeholder: 'https://en.wikipedia.org/wiki/...' },
    { id: 'tableIndex', label: 'Table Index', type: 'number', required: false, defaultValue: 0, placeholder: '0 (First table)' }
  ],
  testConnection: async (config) => {
    if (!desktopBridge.isElectron()) {
      return { status: 'error', message: 'HTML extraction requires the Desktop runtime.' };
    }
    try {
      const tables = await desktopBridge.web.fetchHtmlTables(config.url);
      if (tables.length === 0) {
        return { status: 'error', message: 'No tabular data found on page.' };
      }
      return { status: 'success', message: `Found ${tables.length} tables.` };
    } catch (e: any) {
      return { status: 'error', message: e.message || 'Failed to fetch page.' };
    }
  },
  preview: async (config) => {
    const tables = await desktopBridge.web.fetchHtmlTables(config.url);
    if (tables.length === 0) throw new Error('No tables found.');
    const index = config.tableIndex ? parseInt(config.tableIndex) : 0;
    const table = tables[index] || tables[0];
    
    return {
      columns: table.columns,
      rows: table.rows.slice(0, 100),
      rowCount: table.rows.length,
      columnCount: table.columns.length
    };
  },
  import: async (config) => {
    const tables = await desktopBridge.web.fetchHtmlTables(config.url);
    if (tables.length === 0) throw new Error('No tables found.');
    const index = config.tableIndex ? parseInt(config.tableIndex) : 0;
    const table = tables[index] || tables[0];
    
    return {
      columns: table.columns,
      rows: table.rows
    };
  }
};

export const odataConnector: Connector = {
  id: 'web-odata',
  name: 'OData Feed',
  category: 'web',
  description: 'Connect to an OData service endpoint.',
  icon: 'Globe',
  configFields: [
    { id: 'url', label: 'OData URL', type: 'text', required: true, placeholder: 'https://services.odata.org/V4/TripPinServiceRW/People' }
  ],
  testConnection: async (config) => {
    try {
      const response = await desktopBridge.web.fetchRest({ url: config.url, method: 'GET' });
      if (response && response.value) {
        return { status: 'success', message: 'OData feed connected.' };
      }
      return { status: 'success', message: 'Connected, but unexpected format.' };
    } catch (e: any) {
      return { status: 'error', message: e.message || 'Failed to connect.' };
    }
  },
  preview: async (config) => {
    const rawData = await desktopBridge.web.fetchRest({ url: config.url, method: 'GET' });
    const targetData = rawData.value || (Array.isArray(rawData) ? rawData : [rawData]);
    
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
    const rawData = await desktopBridge.web.fetchRest({ url: config.url, method: 'GET' });
    const targetData = rawData.value || (Array.isArray(rawData) ? rawData : [rawData]);
    
    const columns = targetData.length > 0 ? Object.keys(targetData[0]) : [];
    return {
      columns,
      rows: targetData
    };
  }
};
