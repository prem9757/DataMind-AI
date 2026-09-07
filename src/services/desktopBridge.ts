import * as XLSX from 'xlsx';
import { SystemInfo } from '../types/electron';
import { ParseResult, parseRawDatasetContent } from './dataParser';

/**
 * Desktop Environment Service
 *
 * Centralizes all Electron-specific capabilities, native OS dialog interactions,
 * system telemetry, and export adapters with graceful browser fallbacks.
 */
class DesktopBridgeService {
  /**
   * Detects if the application is running inside an Electron desktop window
   */
  public isElectron(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.electronAPI !== 'undefined' &&
      Boolean(window.electronAPI.isElectron)
    );
  }

  /**
   * Retrieves the host platform ('win32', 'darwin', 'linux', or 'browser')
   */
  public async getPlatform(): Promise<string> {
    if (this.isElectron() && window.electronAPI) {
      try {
        return window.electronAPI.platform || (await window.electronAPI.getSystemInfo()).platform;
      } catch {
        return 'win32';
      }
    }
    return 'browser';
  }

  /**
   * Retrieves application version
   */
  public async getVersion(): Promise<string> {
    if (this.isElectron() && window.electronAPI?.getVersion) {
      try {
        return await window.electronAPI.getVersion();
      } catch {
        return '1.0.0 (Desktop)';
      }
    }
    return '1.0.0 (Web)';
  }

  /**
   * Checks whether the application is running in a packaged distribution
   */
  public async isPackaged(): Promise<boolean> {
    if (this.isElectron() && window.electronAPI?.isPackaged) {
      try {
        return await window.electronAPI.isPackaged();
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Retrieves host system hardware and OS metrics (CPU cores, RAM, OS platform)
   */
  public async getSystemInfo(): Promise<SystemInfo | null> {
    if (this.isElectron() && window.electronAPI?.getSystemInfo) {
      try {
        return await window.electronAPI.getSystemInfo();
      } catch (err) {
        console.warn('Failed to retrieve desktop system metrics:', err);
        return null;
      }
    }

    // Graceful browser fallback for UI consistency
    if (typeof navigator !== 'undefined') {
      return {
        platform: navigator.platform || 'Web Browser',
        arch: 'wasm/v8',
        release: navigator.userAgent.slice(0, 30),
        cpuModel: 'Client Host Processor',
        cpuCores: navigator.hardwareConcurrency || 4,
        totalMemoryGB: (navigator as any).deviceMemory || 8,
        freeMemoryGB: Math.max(1, ((navigator as any).deviceMemory || 8) * 0.4),
      };
    }

    return null;
  }

  /**
   * Window state controls for desktop titlebar or modal interactions
   */
  public window = {
    minimize: async (): Promise<void> => {
      if (this.isElectron() && window.electronAPI?.window?.minimize) {
        await window.electronAPI.window.minimize();
      }
    },
    maximize: async (): Promise<void> => {
      if (this.isElectron() && window.electronAPI?.window?.maximize) {
        await window.electronAPI.window.maximize();
      }
    },
    close: async (): Promise<void> => {
      if (this.isElectron() && window.electronAPI?.window?.close) {
        await window.electronAPI.window.close();
      }
    },
    isMaximized: async (): Promise<boolean> => {
      if (this.isElectron() && window.electronAPI?.window?.isMaximized) {
        return await window.electronAPI.window.isMaximized();
      }
      return false;
    }
  };

  /**
   * Native Dataset Ingestion:
   * Opens the native Windows/OS file picker and reads the selected file safely.
   */
  public async openDataset(): Promise<{
    canceled: boolean;
    error?: string;
    result?: ParseResult;
  }> {
    if (!this.isElectron() || !window.electronAPI?.files?.openDataset) {
      return {
        canceled: true,
        error: 'Desktop file selection is only available inside Electron desktop mode.'
      };
    }

    try {
      const fileData = await window.electronAPI.files.openDataset({
        title: 'Select Tabular Dataset (CSV, XLSX, XLS, JSON)',
        filters: [
          { name: 'Supported Datasets (*.csv, *.xlsx, *.xls, *.json)', extensions: ['csv', 'xlsx', 'xls', 'json'] },
          { name: 'CSV Spreadsheets (*.csv)', extensions: ['csv'] },
          { name: 'Excel Workbooks (*.xlsx, *.xls)', extensions: ['xlsx', 'xls'] },
          { name: 'JSON Data (*.json)', extensions: ['json'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ]
      });

      if (fileData.canceled || !fileData.content) {
        return { canceled: true };
      }

      if (fileData.error) {
        return { canceled: false, error: fileData.error };
      }

      const parsed = await parseRawDatasetContent({
        fileName: fileData.fileName || 'dataset.csv',
        fileSize: fileData.fileSize || fileData.content.length,
        fileType: fileData.fileType || 'CSV',
        content: fileData.content,
        isBase64: fileData.isBase64
      });

      return {
        canceled: false,
        result: parsed
      };
    } catch (err: any) {
      console.error('Desktop dataset open error:', err);
      return {
        canceled: false,
        error: err.message || 'Failed to open and parse local dataset.'
      };
    }
  }

  /**
   * Unified File Export Adapter:
   * Routes to native Windows Save As dialog when in desktop mode,
   * or standard browser download when running in the browser.
   */
  public async exportFile(options: {
    defaultPath: string;
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    content: string;
    isBase64?: boolean;
    mimeType?: string;
  }): Promise<{
    canceled: boolean;
    success: boolean;
    filePath?: string;
    error?: string;
  }> {
    // 1. Electron Desktop Mode -> Native Save As Dialog
    if (this.isElectron() && window.electronAPI?.files?.saveFile) {
      try {
        return await window.electronAPI.files.saveFile({
          title: options.title || 'Save File As',
          defaultPath: options.defaultPath,
          filters: options.filters || [{ name: 'All Files (*.*)', extensions: ['*'] }],
          content: options.content,
          isBase64: options.isBase64 || false
        });
      } catch (err: any) {
        console.error('Native save error:', err);
        return { canceled: false, success: false, error: err.message || 'Failed to save file.' };
      }
    }

    // 2. Browser Mode -> Blob Download
    try {
      let blob: Blob;
      if (options.isBase64) {
        const byteCharacters = atob(options.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: options.mimeType || 'application/octet-stream' });
      } else {
        blob = new Blob([options.content], { type: options.mimeType || 'text/plain;charset=utf-8;' });
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', options.defaultPath);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      return { canceled: false, success: true };
    } catch (err: any) {
      return { canceled: false, success: false, error: err.message || 'Browser export failed.' };
    }
  }

  /**
   * Export an Excel Workbook seamlessly in both Desktop and Browser environments
   */
  public async exportWorkbook(
    workbook: XLSX.WorkBook,
    defaultFilename: string
  ): Promise<{ canceled: boolean; success: boolean; filePath?: string; error?: string }> {
    if (this.isElectron() && window.electronAPI?.files?.saveFile) {
      const base64Data = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      return await this.exportFile({
        defaultPath: defaultFilename,
        title: 'Export Excel Workbook',
        filters: [
          { name: 'Excel Spreadsheets (*.xlsx)', extensions: ['xlsx'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ],
        content: base64Data,
        isBase64: true,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
    }

    // Browser fallback
    XLSX.writeFile(workbook, defaultFilename);
    return { canceled: false, success: true };
  }

  /**
   * Export an arbitrary Blob (PDF, PNG, etc.) in both Desktop and Browser environments
   */
  public async exportBlob(
    blob: Blob,
    defaultFilename: string,
    filters?: Array<{ name: string; extensions: string[] }>
  ): Promise<{ canceled: boolean; success: boolean; filePath?: string; error?: string }> {
    if (this.isElectron() && window.electronAPI?.files?.saveFile) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1] || '';
          const res = await this.exportFile({
            defaultPath: defaultFilename,
            filters: filters || [{ name: 'All Files (*.*)', extensions: ['*'] }],
            content: base64,
            isBase64: true,
            mimeType: blob.type
          });
          resolve(res);
        };
        reader.onerror = () => {
          resolve({ canceled: false, success: false, error: 'Failed to serialize blob.' });
        };
        reader.readAsDataURL(blob);
      });
    }

    // Browser fallback
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', defaultFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { canceled: false, success: true };
  }
  public db = {
    testConnection: async (config: any): Promise<{ status: 'success' | 'unsupported' | 'error' | 'idle' | 'testing'; message?: string }> => {
      if (this.isElectron() && window.electronAPI?.db?.testConnection) {
        return await window.electronAPI.db.testConnection(config);
      }
      return { status: 'error', message: 'Database connections require the Desktop application.' };
    },
    getMetadata: async (config: any): Promise<{ tables: string[]; views?: string[] }> => {
      if (this.isElectron() && window.electronAPI?.db?.getMetadata) {
        return await window.electronAPI.db.getMetadata(config);
      }
      throw new Error('Database connections require the Desktop application.');
    },
    query: async (config: any, query: string, limit?: number): Promise<{ columns: string[]; rows: any[] }> => {
      if (this.isElectron() && window.electronAPI?.db?.query) {
        return await window.electronAPI.db.query(config, query, limit);
      }
      throw new Error('Database connections require the Desktop application.');
    }
  };

  public web = {
    fetchRest: async (config: any): Promise<any> => {
      if (this.isElectron() && window.electronAPI?.web?.fetchRest) {
        return await window.electronAPI.web.fetchRest(config);
      }
      // Fallback for browser
      const { url, method = 'GET', headers, body } = config;
      const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    fetchHtmlTables: async (url: string): Promise<any[]> => {
      if (this.isElectron() && window.electronAPI?.web?.fetchHtmlTables) {
        return await window.electronAPI.web.fetchHtmlTables(url);
      }
      throw new Error('Web table extraction requires the Desktop application to bypass CORS.');
    }
  };

  public credentials = {
    save: async (key: string, value: string): Promise<boolean> => {
      if (this.isElectron() && window.electronAPI?.credentials?.save) {
        return await window.electronAPI.credentials.save(key, value);
      }
      return false; // Safely ignore in browser
    },
    load: async (key: string): Promise<string | null> => {
      if (this.isElectron() && window.electronAPI?.credentials?.load) {
        return await window.electronAPI.credentials.load(key);
      }
      return null;
    },
    delete: async (key: string): Promise<boolean> => {
      if (this.isElectron() && window.electronAPI?.credentials?.delete) {
        return await window.electronAPI.credentials.delete(key);
      }
      return false;
    }
  };

  public auth = {
    oauth: async (provider: string, config: any): Promise<{ status: 'success' | 'error'; token?: string; message?: string }> => {
      if (this.isElectron() && window.electronAPI?.auth?.oauth) {
        return await window.electronAPI.auth.oauth(provider, config);
      }
      return { status: 'error', message: 'Desktop runtime required for OAuth.' };
    }
  };
}

export const desktopBridge = new DesktopBridgeService();

