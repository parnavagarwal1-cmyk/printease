const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { WindowsPrinterAdapter } = require('./adapters/printerAdapter');
const { PrintWorker } = require('./worker/printWorker');

let mainWindow = null;
let printerAdapter = null;
let printWorker = null;
const recentJobs = [];

const defaultConfig = {
  backendUrl: 'https://printease-production-7b9f.up.railway.app',
  paired: false,
  deviceToken: null,
  deviceUuid: 'win-agent-' + Math.random().toString(36).substring(2, 10),
  branchId: null,
  branchName: null,
  shopName: null,
  selectedPrinter: null,
  pollIntervalMs: 5000
};

let deviceConfig = { ...defaultConfig };

function getConfigFilePath() {
  try {
    return path.join(app.getPath('userData'), 'device-config.json');
  } catch {
    return path.join(__dirname, '..', 'device-config.json');
  }
}

function loadPersistedConfig() {
  try {
    const filePath = getConfigFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      deviceConfig = { ...defaultConfig, ...data };
      console.log('[PrintEase] Loaded persisted config from:', filePath);
      return;
    }
  } catch (err) {
    console.error('[PrintEase] Error loading persisted config:', err);
  }
  deviceConfig = { ...defaultConfig };
}

function savePersistedConfig(cfg) {
  try {
    const filePath = getConfigFilePath();
    fs.writeFileSync(filePath, JSON.stringify(cfg, null, 2), 'utf8');
    console.log('[PrintEase] Saved config to:', filePath);
  } catch (err) {
    console.error('[PrintEase] Error saving config:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1020,
    height: 720,
    minWidth: 800,
    minHeight: 560,
    title: 'PrintEase Desktop Agent',
    backgroundColor: '#F8FAFC',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  printerAdapter = new WindowsPrinterAdapter(mainWindow);

  printWorker = new PrintWorker({
    getConfig: () => deviceConfig,
    printerAdapter,
    onEvent: (event, data) => {
      if (event === 'job:status-update') {
        const entry = { ...data, timestamp: new Date().toISOString() };
        recentJobs.unshift(entry);
        if (recentJobs.length > 50) recentJobs.pop();
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(event, data);
      }
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Start polling worker if already paired
  if (deviceConfig.paired && deviceConfig.deviceToken) {
    printWorker.start(deviceConfig.pollIntervalMs);
  }
}

app.whenReady().then(() => {
  loadPersistedConfig();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (printWorker) {
    printWorker.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC Handlers ---

ipcMain.handle('app:version', () => {
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch
  };
});

ipcMain.handle('backend:health', async (event, customUrl) => {
  const targetUrl = (customUrl || deviceConfig.backendUrl).replace(/\/+$/, '');
  try {
    const response = await fetch(`${targetUrl}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) {
      return { ok: false, status: response.status, message: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, message: err.message || 'Cannot reach PrintEase server' };
  }
});

ipcMain.handle('printers:list', async () => {
  if (!printerAdapter) {
    return [];
  }
  return await printerAdapter.getPrinters();
});

ipcMain.handle('printers:status', async (event, printerName) => {
  if (!printerAdapter) {
    return { status: 'OFFLINE', ready: false };
  }
  return await printerAdapter.getPrinterStatus(printerName);
});

ipcMain.handle('device:config', () => {
  return deviceConfig;
});

ipcMain.handle('device:saveConfig', (event, newConfig) => {
  deviceConfig = { ...deviceConfig, ...newConfig };
  savePersistedConfig(deviceConfig);
  return { success: true, config: deviceConfig };
});

ipcMain.handle('device:pair', async (event, pairingCode) => {
  const code = (pairingCode || '').trim();
  if (!code) {
    return { success: false, message: 'Please enter a valid pairing code.' };
  }

  try {
    const targetUrl = deviceConfig.backendUrl.replace(/\/+$/, '');
    const response = await fetch(`${targetUrl}/api/desktop/pair`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        pairing_code: code,
        device_name: 'Windows Desktop Client',
        device_uuid: deviceConfig.deviceUuid,
        os_info: `Windows ${process.arch}`,
        app_version: app.getVersion() || '1.0.0'
      }),
      signal: AbortSignal.timeout(8000)
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, message: data.message || 'Pairing failed' };
    }

    deviceConfig.paired = true;
    deviceConfig.deviceToken = data.device_token;
    deviceConfig.branchId = data.branch.id;
    deviceConfig.branchName = data.branch.name;
    deviceConfig.shopName = data.branch.shop_name;
    savePersistedConfig(deviceConfig);

    // Start background print polling worker
    if (printWorker) {
      printWorker.start(deviceConfig.pollIntervalMs);
    }

    return {
      success: true,
      message: data.message,
      token: data.device_token,
      branch: data.branch
    };
  } catch (err) {
    return { success: false, message: err.message || 'Failed to connect to backend during pairing' };
  }
});

ipcMain.handle('jobs:pollNow', async () => {
  if (!printWorker) {
    return { success: false, message: 'Worker not initialized' };
  }
  await printWorker.triggerPoll();
  return { success: true, recentJobs };
});

ipcMain.handle('jobs:recent', () => {
  return recentJobs;
});
