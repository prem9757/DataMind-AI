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
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI;
  }
}
