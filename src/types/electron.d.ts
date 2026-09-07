export interface SystemInfo {
  platform: string;
  arch: string;
  release: string;
  cpuModel: string;
  cpuCores: number;
  totalMemoryGB: number;
  freeMemoryGB: number;
}

export interface DesktopDatasetFile {
  canceled: boolean;
  filePath?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  content?: string;
  isBase64?: boolean;
  error?: string;
}

export interface DesktopSaveResult {
  canceled: boolean;
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface DBConfig {
  type: string;
  host?: string;
  port?: number | string;
  database?: string;
  user?: string;
  password?: string;
  options?: any;
}

export interface ElectronBridgeAPI {
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
    }) => Promise<DesktopDatasetFile>;
    saveFile: (payload: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      content: string;
      isBase64?: boolean;
    }) => Promise<DesktopSaveResult>;
  };
  ai: {
    analyze: (payload: any) => Promise<any>;
  };
  db: {
    testConnection: (config: DBConfig) => Promise<{ status: 'success' | 'unsupported' | 'error' | 'idle' | 'testing'; message?: string }>;
    getMetadata: (config: DBConfig) => Promise<{ tables: string[]; views?: string[] }>;
    query: (config: DBConfig, query: string, limit?: number) => Promise<{ columns: string[]; rows: any[] }>;
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

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI;
  }
}

