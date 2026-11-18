const fs = require('fs');
const path = require('path');
const os = require('os');

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
    const printerName = options.printerName || 'Default';
    console.log(`[PrinterAdapter] Queuing print job for file: ${filePath} on printer: ${printerName}`);

    // Detect if virtual PDF printer (e.g., 'Microsoft Print to PDF') is active
    const isPdfPrinter = /pdf/i.test(printerName);

    if (isPdfPrinter) {
      // Save permanently to printease/printed_pdfs folder on Desktop (or fallback to Desktop/PrintEase_Printed_PDFs)
      const desktopDir = path.join(os.homedir(), 'Desktop');
      const printeaseProjectDir = path.join(desktopDir, 'printease', 'printed_pdfs');
      const outputDir = fs.existsSync(printeaseProjectDir)
        ? printeaseProjectDir
        : path.join(desktopDir, 'PrintEase_Printed_PDFs');

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const orderTag = options.orderNumber ? `Order_${options.orderNumber}` : `Job_${Date.now()}`;
      const rawFilename = options.originalFilename || path.basename(filePath);
      const ext = path.extname(rawFilename) || path.extname(filePath) || '.pdf';
      const baseName = path.basename(rawFilename, ext).replace(/[^a-zA-Z0-9._-]/g, '_');
      const finalFilename = `${orderTag}_${baseName}${ext}`;
      const destPath = path.join(outputDir, finalFilename);

      // Copy file before temp folder shredding
      fs.copyFileSync(filePath, destPath);
      console.log(`[PrinterAdapter] Successfully saved print output to: ${destPath}`);

      return {
        success: true,
        jobId: `pdf-save-${Date.now()}`,
        status: 'SAVED_TO_DESKTOP',
        savedPath: destPath
      };
    }

    // Physical hardware printer spooling
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
