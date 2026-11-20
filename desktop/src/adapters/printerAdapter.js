const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function convertImageToGrayscale(imagePath) {
  try {
    const fullPath = path.resolve(imagePath);
    const escaped = fullPath.replace(/'/g, "''");
    const script = [
      'Add-Type -AssemblyName System.Drawing',
      `$p = '${escaped}'`,
      '$img = [System.Drawing.Image]::FromFile($p)',
      '$bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height)',
      '$g = [System.Drawing.Graphics]::FromImage($bmp)',
      '$cm = New-Object System.Drawing.Imaging.ColorMatrix',
      '$cm.Matrix00 = 0.299; $cm.Matrix01 = 0.299; $cm.Matrix02 = 0.299',
      '$cm.Matrix10 = 0.587; $cm.Matrix11 = 0.587; $cm.Matrix12 = 0.587',
      '$cm.Matrix20 = 0.114; $cm.Matrix21 = 0.114; $cm.Matrix22 = 0.114',
      '$cm.Matrix33 = 1.0;   $cm.Matrix44 = 1.0',
      '$ia = New-Object System.Drawing.Imaging.ImageAttributes',
      '$ia.SetColorMatrix($cm)',
      '$rect = New-Object System.Drawing.Rectangle(0, 0, $img.Width, $img.Height)',
      '$g.DrawImage($img, $rect, 0, 0, $img.Width, $img.Height, [System.Drawing.GraphicsUnit]::Pixel, $ia)',
      '$g.Dispose()',
      '$img.Dispose()',
      '$ext = [System.IO.Path]::GetExtension($p).ToLower()',
      '$fmt = [System.Drawing.Imaging.ImageFormat]::Jpeg',
      'if ($ext -eq ".png") { $fmt = [System.Drawing.Imaging.ImageFormat]::Png }',
      'elseif ($ext -eq ".bmp") { $fmt = [System.Drawing.Imaging.ImageFormat]::Bmp }',
      '$bmp.Save($p, $fmt)',
      '$bmp.Dispose()'
    ].join('\r\n');

    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      timeout: 10000
    });
    console.log(`[PrinterAdapter] Successfully converted image to Black & White: ${imagePath}`);
    return true;
  } catch (err) {
    console.warn('[PrinterAdapter] Grayscale conversion warning:', err.message);
    return false;
  }
}

function getSumatraExecutable() {
  const possiblePaths = [
    // 1. Production unpacked path (electron-builder asarUnpack)
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'src', 'bin', 'SumatraPDF.exe'),
    // 2. Production unpacked path alternative
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'bin', 'SumatraPDF.exe'),
    // 3. Local source tree bin
    path.join(__dirname, '..', 'bin', 'SumatraPDF.exe'),
    // 4. node_modules pdf-to-printer
    path.join(__dirname, '..', '..', 'node_modules', 'pdf-to-printer', 'dist', 'SumatraPDF-3.4.6-32.exe'),
    // 5. Persistent AppData folder
    path.join(os.homedir(), 'AppData', 'Roaming', 'printease-desktop', 'bin', 'SumatraPDF.exe')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Fallback: extract from bundle to AppData if running inside asar
  const targetPath = path.join(os.homedir(), 'AppData', 'Roaming', 'printease-desktop', 'bin', 'SumatraPDF.exe');
  try {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const bundled = path.join(__dirname, '..', 'bin', 'SumatraPDF.exe');
    if (fs.existsSync(bundled)) {
      fs.writeFileSync(targetPath, fs.readFileSync(bundled));
      return targetPath;
    }
  } catch (err) {
    console.warn('[PrinterAdapter] Failed to extract bundled SumatraPDF:', err.message);
  }

  return targetPath;
}

function printToPhysicalPrinter(filePath, printerName, options = {}) {
  const sumatraExe = getSumatraExecutable();
  console.log(`[PrinterAdapter] Using SumatraPDF engine: ${sumatraExe}`);
  
  if (!fs.existsSync(sumatraExe)) {
    throw new Error(`Print engine executable not found on system: ${sumatraExe}`);
  }

  const printMode = (options.options?.print_mode || options.options?.color_mode || '').toLowerCase();
  const isBw = (printMode === 'bw' || printMode === 'monochrome' || printMode === 'grayscale');
  const copies = parseInt(options.options?.copies || options.copies || 1, 10);
  const paperSize = options.options?.paper_size || 'A4';
  const orientation = (options.options?.orientation || 'portrait').toLowerCase();

  const args = [
    '-print-to', printerName,
    '-silent'
  ];

  const settings = [];
  if (copies > 1) settings.push(`${copies}x`);
  if (isBw) settings.push('monochrome');
  else settings.push('color');
  settings.push('fit');
  if (paperSize) settings.push(`paper=${paperSize}`);
  if (orientation === 'landscape') settings.push('landscape');

  if (settings.length > 0) {
    args.push('-print-settings', settings.join(','));
  }

  args.push(filePath);

  console.log(`[PrinterAdapter] Spooling to hardware printer "${printerName}" with args: ${args.join(' ')}`);

  try {
    execFileSync(sumatraExe, args, {
      windowsHide: true,
      timeout: 60000
    });
    console.log(`[PrinterAdapter] ✓ Print job successfully spooled to "${printerName}"!`);
    return { success: true };
  } catch (err) {
    console.error(`[PrinterAdapter] Primary print spooling failed:`, err.message);

    // Fallback: PowerShell PrintTo verb
    console.log(`[PrinterAdapter] Attempting fallback via PowerShell PrintTo verb...`);
    const escapedFile = filePath.replace(/'/g, "''");
    const escapedPrinter = printerName.replace(/'/g, "''");
    const psScript = `Start-Process -FilePath '${escapedFile}' -Verb PrintTo -ArgumentList '"${escapedPrinter}"' -PassThru | Wait-Process -Timeout 20`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      timeout: 25000
    });

    console.log(`[PrinterAdapter] ✓ Fallback print job dispatched to "${printerName}"!`);
    return { success: true, method: 'powershell-verb' };
  }
}

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

    // 1. Always save a permanent backup copy in printease/printed_pdfs
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
    console.log(`[PrinterAdapter] Permanent copy stored at: ${destPath}`);

    // Apply Black & White / Grayscale conversion if requested
    const printMode = (options.options?.print_mode || options.options?.color_mode || '').toLowerCase();
    const isBw = (printMode === 'bw' || printMode === 'monochrome' || printMode === 'grayscale');

    if (isBw && /\.(jpg|jpeg|png|bmp)$/i.test(destPath)) {
      convertImageToGrayscale(destPath);
    }

    if (isPdfPrinter) {
      console.log(`[PrinterAdapter] Virtual PDF printer detected. Document preserved in output folder.`);
      return {
        success: true,
        jobId: `pdf-save-${Date.now()}`,
        status: 'SAVED_TO_DESKTOP',
        savedPath: destPath
      };
    }

    // 2. Real Physical hardware printer spooling
    console.log(`[PrinterAdapter] Sending document to physical printer: "${printerName}"...`);
    const printResult = printToPhysicalPrinter(destPath, printerName, options);

    return {
      success: true,
      jobId: `spool-${Date.now()}`,
      status: 'PRINTED_TO_HARDWARE',
      printer: printerName,
      method: printResult.method || 'sumatrapdf',
      savedPath: destPath
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
