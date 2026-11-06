const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  checkHealth: (backendUrl) => ipcRenderer.invoke('backend:health', backendUrl),
  getPrinters: () => ipcRenderer.invoke('printers:list'),
  getPrinterStatus: (printerName) => ipcRenderer.invoke('printers:status', printerName),
  getDeviceConfig: () => ipcRenderer.invoke('device:config'),
  saveDeviceConfig: (config) => ipcRenderer.invoke('device:saveConfig', config),
  pairDevice: (pairingCode) => ipcRenderer.invoke('device:pair', pairingCode),
  pollNow: () => ipcRenderer.invoke('jobs:pollNow'),
  getRecentJobs: () => ipcRenderer.invoke('jobs:recent'),
  onJobStatusUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('job:status-update', handler);
    return () => ipcRenderer.removeListener('job:status-update', handler);
  }
});
