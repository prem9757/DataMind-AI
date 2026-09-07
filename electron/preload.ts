import { contextBridge, ipcRenderer } from 'electron';

export interface SystemInfo {
  platform: string;
  arch: string;
  release: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
}

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  getVersion: () => Promise<string>;
  isPackaged: () => Promise<boolean>;
  getSystemInfo: () => Promise<SystemInfo>;
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  dialog: {
    showOpenDialog: (options?: {
      title?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<{ canceled: boolean; filePaths: string[] }>;
    showSaveDialog: (options?: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<{ canceled: boolean; filePath?: string }>;
  };
  files: {
    openDataset: (options?: {
      title?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
    }) => Promise<{
      canceled: boolean;
      filePath?: string;
      fileName?: string;
      fileSize?: number;
      fileType?: string;
      content?: string;
      isBase64?: boolean;
      error?: string;
    }>;
    saveFile: (payload: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      content: string;
      isBase64?: boolean;
    }) => Promise<{
      canceled: boolean;
      success: boolean;
      filePath?: string;
      error?: string;
    }>;
  };
  ai: {
    analyze: (payload: any) => Promise<any>;
  };
  db: {
    testConnection: (config: any) => Promise<{ status: string; message?: string }>;
    getMetadata: (config: any) => Promise<{ tables: string[]; views?: string[] }>;
    query: (config: any, query: string, limit?: number) => Promise<{ columns: string[]; rows: any[] }>;
  };
  web: {
    fetchRest: (config: any) => Promise<any>;
    fetchHtmlTables: (url: string) => Promise<any[]>;
  };
  credentials: {
    save: (key: string, value: string) => Promise<boolean>;
    load: (key: string) => Promise<string | null>;
    delete: (key: string) => Promise<boolean>;
  };
  auth: {
    oauth: (provider: string, config: any) => Promise<{ status: 'success' | 'error'; token?: string; message?: string }>;
  };
}

const electronAPI: ElectronAPI = {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  isPackaged: () => ipcRenderer.invoke('app:is-packaged'),
  getSystemInfo: () => ipcRenderer.invoke('system:get-info'),
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:show-save-dialog', options),
  },
  files: {
    openDataset: (options) => ipcRenderer.invoke('files:open-dataset', options),
    saveFile: (payload) => ipcRenderer.invoke('files:save-file', payload),
  },
  ai: {
    analyze: (payload) => ipcRenderer.invoke('ai:gemini-analyze', payload),
  },
  db: {
    testConnection: (config: any) => ipcRenderer.invoke('db:test-connection', config),
    getMetadata: (config: any) => ipcRenderer.invoke('db:get-metadata', config),
    query: (config: any, query: string, limit?: number) => ipcRenderer.invoke('db:query', { config, query, limit }),
  },
  web: {
    fetchRest: (config: any) => ipcRenderer.invoke('web:fetch-rest', config),
    fetchHtmlTables: (url: string) => ipcRenderer.invoke('web:fetch-html-tables', url),
  },
  credentials: {
    save: (key: string, value: string) => ipcRenderer.invoke('credentials:save', { key, value }),
    load: (key: string) => ipcRenderer.invoke('credentials:load', key),
    delete: (key: string) => ipcRenderer.invoke('credentials:delete', key),
  },
  auth: {
    oauth: (provider: string, config: any) => ipcRenderer.invoke('auth:oauth', { provider, config }),
  },
};

// Expose safe, isolated bridge to the renderer window
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
