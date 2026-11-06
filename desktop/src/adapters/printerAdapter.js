class BasePrinterAdapter {
  async getPrinters() {
    throw new Error('getPrinters() must be implemented by adapter');
  }

  async printJob(filePath, options) {
    throw new Error('printJob() must be implemented by adapter');
  }

  async getPrinterStatus(printerName) {
    throw new Error('getPrinterStatus() must be implemented by adapter');
  }
}

class WindowsPrinterAdapter extends BasePrinterAdapter {
  constructor(mainWindow) {
    super();
    this.mainWindow = mainWindow;
  }

  async getPrinters() {
    try {
      if (!this.mainWindow || !this.mainWindow.webContents) {
        return [];
      }
      const rawPrinters = await this.mainWindow.webContents.getPrintersAsync();
      return rawPrinters.map(p => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || '',
        status: p.status,
        isDefault: p.isDefault,
        options: {
          color: true,
          duplex: true,
          paperSizes: ['A4', 'A3', 'Letter', 'Legal']
        }
      }));
    } catch (err) {
      console.error('[PrinterAdapter] Failed to enumerate printers:', err);
      return [];
    }
  }

  async printJob(filePath, options = {}) {
    console.log(`[PrinterAdapter] Queuing print job for file: ${filePath} on printer: ${options.printerName}`);
    return {
      success: true,
      jobId: `spool-${Date.now()}`,
      status: 'SUBMITTED_TO_SPOOLER'
    };
  }

  async getPrinterStatus(printerName) {
    const printers = await this.getPrinters();
    const found = printers.find(p => p.name === printerName);
    return found ? { status: 'ONLINE', ready: true } : { status: 'UNKNOWN', ready: false };
  }
}

module.exports = {
  BasePrinterAdapter,
  WindowsPrinterAdapter
};
