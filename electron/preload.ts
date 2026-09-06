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
};

// Expose safe, isolated bridge to the renderer window
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
