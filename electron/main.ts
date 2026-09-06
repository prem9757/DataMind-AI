import { app, BrowserWindow, ipcMain, dialog, shell, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { GoogleGenAI } from '@google/genai';

let mainWindow: BrowserWindow | null = null;

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

function getWindowStateFilePath(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadSavedWindowState(): WindowState | null {
  try {
    const file = getWindowStateFilePath();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (typeof data.width === 'number' && typeof data.height === 'number') {
        return data;
      }
    }
  } catch {
    // Ignore error, fallback to defaults
  }
  return null;
}

function saveWindowState(win: BrowserWindow) {
  try {
    if (win.isDestroyed()) return;
    const isMaximized = win.isMaximized();
    const bounds = win.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized,
    };
    fs.writeFileSync(getWindowStateFilePath(), JSON.stringify(state), 'utf8');
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}

/**
 * Creates the primary application window with strict security configurations.
 */
function createMainWindow(): BrowserWindow {
  const savedState = loadSavedWindowState();
  let width = 1440;
  let height = 900;
  let x: number | undefined = undefined;
  let y: number | undefined = undefined;

  if (savedState) {
    width = Math.max(1100, savedState.width);
    height = Math.max(700, savedState.height);
    if (typeof savedState.x === 'number' && typeof savedState.y === 'number') {
      try {
        const matchingDisplay = screen.getDisplayMatching({
          x: savedState.x,
          y: savedState.y,
          width,
          height,
        });
        if (matchingDisplay) {
          x = savedState.x;
          y = savedState.y;
        }
      } catch {
        // Fallback to centered
      }
    }
  }

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 1100,
    minHeight: 700,
    center: x === undefined,
    title: 'Smart Data Analysis Assistant',
    icon: fs.existsSync(path.join(__dirname, '../build/icon.png'))
      ? path.join(__dirname, '../build/icon.png')
      : fs.existsSync(path.join(app.getAppPath(), 'build/icon.png'))
      ? path.join(app.getAppPath(), 'build/icon.png')
      : undefined,
    backgroundColor: '#0B0D11',
    show: false, // Prevents white flash before rendering dark theme
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  if (savedState?.isMaximized) {
    win.maximize();
  }

  // Reveal window smoothly once painted
  win.once('ready-to-show', () => {
    win.show();
  });

  // Save window dimensions and positions on close
  win.on('close', () => {
    saveWindowState(win);
  });

  // Security: Deny window creation from renderer and open external links in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Security: Prevent unauthorized in-app navigation
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    // Allow local dev server or local file navigation
    if (
      parsedUrl.protocol === 'file:' ||
      parsedUrl.hostname === 'localhost' ||
      parsedUrl.hostname === '127.0.0.1' ||
      parsedUrl.hostname === '0.0.0.0'
    ) {
      return;
    }
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });

  // Load URL depending on environment
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null);

  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    // In production, load the built Vite bundle from the dist directory
    const candidatePaths = [
      path.join(__dirname, '../dist/index.html'),
      path.join(app.getAppPath(), 'dist/index.html'),
      path.join(process.resourcesPath, 'app.asar/dist/index.html'),
      path.join(process.resourcesPath, 'app/dist/index.html'),
    ];

    const distPath = candidatePaths.find(p => fs.existsSync(p)) || candidatePaths[0];

    win.loadFile(distPath).catch(err => {
      console.error('Failed to load local HTML bundle from', distPath, 'error:', err);
    });
  }

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

// ============================================================================
// IPC HANDLERS (SECURE ISOLATED BRIDGE)
// ============================================================================

function registerIpcHandlers() {
  // App metadata
  ipcMain.handle('app:get-version', () => app.getVersion());
  ipcMain.handle('app:get-platform', () => process.platform);
  ipcMain.handle('app:is-packaged', () => app.isPackaged);

  // Read-only system metrics for local resource utilization (CPU, RAM, OS)
  ipcMain.handle('system:get-info', () => {
    const cpus = os.cpus();
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpuModel: cpus[0]?.model || 'Generic Processor',
      cpuCores: cpus.length,
      totalMemoryGB: Number((os.totalmem() / (1024 ** 3)).toFixed(2)),
      freeMemoryGB: Number((os.freemem() / (1024 ** 3)).toFixed(2)),
    };
  });

  // Window controls
  ipcMain.handle('window:minimize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  });

  ipcMain.handle('window:is-maximized', () => {
    return mainWindow && !mainWindow.isDestroyed() ? mainWindow.isMaximized() : false;
  });

  // Native Open Dialog (Safe file selection for CSV, XLSX, JSON)
  ipcMain.handle('dialog:show-open-dialog', async (_event, options) => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return await dialog.showOpenDialog(mainWindow, {
      title: options?.title || 'Open Dataset',
      filters: options?.filters || [
        { name: 'Datasets (*.csv, *.xlsx, *.xls, *.json)', extensions: ['csv', 'xlsx', 'xls', 'json'] },
        { name: 'CSV Files (*.csv)', extensions: ['csv'] },
        { name: 'Excel Spreadsheets (*.xlsx, *.xls)', extensions: ['xlsx', 'xls'] },
        { name: 'JSON Files (*.json)', extensions: ['json'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ],
      properties: ['openFile'],
    });
  });

  // Native Save Dialog (Safe file destination for reports, exports, cleaning receipts)
  ipcMain.handle('dialog:show-save-dialog', async (_event, options) => {
    if (!mainWindow) return { canceled: true };
    return await dialog.showSaveDialog(mainWindow, {
      title: options?.title || 'Export Analysis',
      defaultPath: options?.defaultPath,
      filters: options?.filters || [
        { name: 'CSV Files (*.csv)', extensions: ['csv'] },
        { name: 'Excel Spreadsheets (*.xlsx)', extensions: ['xlsx'] },
        { name: 'JSON Files (*.json)', extensions: ['json'] },
        { name: 'PDF Document (*.pdf)', extensions: ['pdf'] },
        { name: 'HTML Report (*.html)', extensions: ['html'] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ],
    });
  });

  // Native Dataset Ingestion: opens native dialog and safely reads selected file content
  ipcMain.handle('files:open-dataset', async (_event, options) => {
    if (!mainWindow) return { canceled: true };
    try {
      const dialogResult = await dialog.showOpenDialog(mainWindow, {
        title: options?.title || 'Open Tabular Dataset',
        filters: options?.filters || [
          { name: 'Supported Datasets (*.csv, *.xlsx, *.xls, *.json)', extensions: ['csv', 'xlsx', 'xls', 'json'] },
          { name: 'CSV Files (*.csv)', extensions: ['csv'] },
          { name: 'Excel Spreadsheets (*.xlsx, *.xls)', extensions: ['xlsx', 'xls'] },
          { name: 'JSON Files (*.json)', extensions: ['json'] },
          { name: 'All Files (*.*)', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
        return { canceled: true };
      }

      const filePath = dialogResult.filePaths[0];
      if (!fs.existsSync(filePath)) {
        return { canceled: false, error: 'Selected file does not exist on disk.' };
      }

      const stat = await fs.promises.stat(filePath);
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase().replace('.', '');

      const isBinary = ext === 'xlsx' || ext === 'xls';
      let content: string;

      if (isBinary) {
        const buffer = await fs.promises.readFile(filePath);
        content = buffer.toString('base64');
      } else {
        content = await fs.promises.readFile(filePath, 'utf8');
      }

      return {
        canceled: false,
        filePath,
        fileName,
        fileSize: stat.size,
        fileType: ext.toUpperCase(),
        content,
        isBase64: isBinary
      };
    } catch (err: any) {
      console.error('Desktop dataset open error:', err);
      return { canceled: false, error: err.message || 'Failed to read dataset file.' };
    }
  });

  // Native Save File: prompts user with native Save As dialog and safely writes to chosen path
  ipcMain.handle('files:save-file', async (_event, payload: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    content: string;
    isBase64?: boolean;
  }) => {
    if (!mainWindow) return { canceled: true, success: false };
    try {
      const dialogResult = await dialog.showSaveDialog(mainWindow, {
        title: payload?.title || 'Save File As',
        defaultPath: payload?.defaultPath || 'export',
        filters: payload?.filters || [
          { name: 'All Files (*.*)', extensions: ['*'] }
        ]
      });

      if (dialogResult.canceled || !dialogResult.filePath) {
        return { canceled: true, success: false };
      }

      const targetPath = dialogResult.filePath;
      if (payload.isBase64) {
        const buffer = Buffer.from(payload.content, 'base64');
        await fs.promises.writeFile(targetPath, buffer);
      } else {
        await fs.promises.writeFile(targetPath, payload.content, 'utf8');
      }

      return {
        canceled: false,
        success: true,
        filePath: targetPath
      };
    } catch (err: any) {
      console.error('Desktop file save error:', err);
      return { canceled: false, success: false, error: err.message || 'Failed to save file.' };
    }
  });

  // Secure Gemini AI execution in desktop mode (uses environment key without exposing it to renderer)
  ipcMain.handle('ai:gemini-analyze', async (_event, payload) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return { error: 'No GEMINI_API_KEY configured in environment.' };
      }

      const { query, datasetSummary, sampleRows, history } = payload || {};

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'smart-data-analysis-assistant-desktop',
          },
        },
      });

      const prompt = `You are DataMind AI, an elite Senior Principal Data Analyst.
A user is asking a question about a dataset. Answer with extreme analytical rigor using ONLY facts and values grounded in the dataset provided. Never hallucinate columns or invent numbers.

Dataset Summary:
Name: ${datasetSummary?.name || 'Dataset'}
Total Rows: ${datasetSummary?.totalRows || 0}
Columns & Profiles:
${JSON.stringify(datasetSummary?.columns || [], null, 2)}

Sample Data Rows:
${JSON.stringify(sampleRows || [], null, 2)}

Conversation History:
${JSON.stringify(history || [], null, 2)}

User Question: "${query}"

Return a valid JSON object matching this structure:
{
  "directAnswer": "Clear, concise direct answer containing exact numbers, percentages, and segment names.",
  "supportingMetrics": [
    {"label": "Metric Name", "value": "Formatted Value", "change": "+X%"}
  ],
  "chartData": {
    "type": "bar",
    "title": "Chart Title",
    "xAxisLabel": "X-axis column",
    "yAxisLabel": "Y-axis metric",
    "data": [{"Category": "A", "Value": 100}, {"Category": "B", "Value": 150}],
    "keys": ["Value"]
  },
  "explanation": "2-3 sentences explaining the analytical calculation performed and why.",
  "businessImplication": "Strategic takeaway for executive leadership and recommended action.",
  "pythonCode": "# Python pandas code executing this exact calculation\\nimport pandas as pd\\n...",
  "suggestedFollowUps": ["Follow-up question 1", "Follow-up question 2", "Follow-up question 3"]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text || '{}';
      try {
        return JSON.parse(text);
      } catch {
        return { text };
      }
    } catch (err: any) {
      console.error('Desktop Gemini analysis error:', err);
      return { error: err.message || 'Desktop analysis failed' };
    }
  });
}

// ============================================================================
// APP LIFECYCLE
// ============================================================================

app.whenReady().then(() => {
  registerIpcHandlers();
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // On Windows and Linux, quit app when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

