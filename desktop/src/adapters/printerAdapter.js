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

function printImageViaPowerShell(imagePath, printerName, options = {}) {
  const printMode = (options.options?.print_mode || options.options?.color_mode || '').toLowerCase();
  const isBw = (printMode === 'bw' || printMode === 'monochrome' || printMode === 'grayscale');
  const copies = parseInt(options.options?.copies || options.copies || 1, 10);

  const escapedFile = imagePath.replace(/'/g, "''");
  const escapedPrinter = printerName.replace(/'/g, "''");

  const psScript = [
    'Add-Type -AssemblyName System.Drawing',
    `$filePath = '${escapedFile}'`,
    `$printerName = '${escapedPrinter}'`,
    '$doc = New-Object System.Drawing.Printing.PrintDocument',
    '$doc.PrinterSettings.PrinterName = $printerName',
    'if (-not $doc.PrinterSettings.IsValid) { throw "Printer [$printerName] is not valid or offline." }',
    `$doc.PrinterSettings.Copies = [short]${copies}`,
    `$doc.DefaultPageSettings.Color = ${isBw ? '$false' : '$true'}`,
    '$img = [System.Drawing.Image]::FromFile($filePath)',
    '$doc.add_PrintPage({',
    '    param($sender, $ev)',
    '    $bounds = $ev.MarginBounds',
    '    $wRatio = $bounds.Width / $img.Width',
    '    $hRatio = $bounds.Height / $img.Height',
    '    $ratio = [Math]::Min($wRatio, $hRatio)',
    '    $w = [int]($img.Width * $ratio)',
    '    $h = [int]($img.Height * $ratio)',
    '    $x = $bounds.Left + [int](($bounds.Width - $w) / 2)',
    '    $y = $bounds.Top + [int](($bounds.Height - $h) / 2)',
    '    $ev.Graphics.DrawImage($img, $x, $y, $w, $h)',
    '    $ev.HasMorePages = $false',
    '})',
    '$doc.Print()',
    '$img.Dispose()',
    '$doc.Dispose()'
  ].join('\r\n');

  const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    windowsHide: true,
    timeout: 30000
  });
  console.log(`[PrinterAdapter] ✓ GDI PrintDocument successfully dispatched to "${printerName}"!`);
  return { success: true, method: 'powershell-gdi' };
}

function printPdfViaEdge(pdfPath, printerName) {
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  let edgeExe = edgePaths.find(p => fs.existsSync(p));
  if (!edgeExe) {
    throw new Error('Microsoft Edge executable not found for fallback PDF printing');
  }

  const args = [
    '--headless',
    '--disable-gpu',
    '--run-all-compositor-stages-before-draw',
    '--print-to-printer',
    `--printer-name=${printerName}`,
    pdfPath
  ];

  execFileSync(edgeExe, args, { windowsHide: true, timeout: 45000 });
  console.log(`[PrinterAdapter] ✓ Microsoft Edge headless PDF print dispatched to "${printerName}"!`);
  return { success: true, method: 'edge-headless' };
}

function printToPhysicalPrinter(filePath, printerName, options = {}) {
  const sumatraExe = getSumatraExecutable();
  console.log(`[PrinterAdapter] Hardware spooling for printer: "${printerName}", engine: ${sumatraExe}`);

  const isImage = /\.(jpg|jpeg|png|bmp)$/i.test(filePath);
  const printMode = (options.options?.print_mode || options.options?.color_mode || '').toLowerCase();
  const isBw = (printMode === 'bw' || printMode === 'monochrome' || printMode === 'grayscale');
  const copies = parseInt(options.options?.copies || options.copies || 1, 10);
  const paperSize = options.options?.paper_size || 'A4';
  const orientation = (options.options?.orientation || 'portrait').toLowerCase();

  // Primary Spooling Engine: SumatraPDF
  if (fs.existsSync(sumatraExe)) {
    try {
      const args = [
        '-print-to', printerName,
        '-console'
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

      console.log(`[PrinterAdapter] SumatraPDF command: ${sumatraExe} ${args.join(' ')}`);
      const output = execFileSync(sumatraExe, args, {
        windowsHide: true,
        encoding: 'utf8',
        timeout: 60000
      });

      if (output && /Printing problem|doesn't exist|failed|error/i.test(output)) {
        throw new Error(`SumatraPDF engine reported issue: ${output.trim()}`);
      }

      console.log(`[PrinterAdapter] ✓ Print job successfully spooled via SumatraPDF to "${printerName}"!`);
      return { success: true, method: 'sumatrapdf' };
    } catch (sumatraErr) {
      console.warn(`[PrinterAdapter] SumatraPDF primary engine failed:`, sumatraErr.message);
    }
  }

  // Engine 2: PowerShell GDI for Images
  if (isImage) {
    try {
      console.log(`[PrinterAdapter] Attempting Engine 2: Native PowerShell GDI PrintDocument for image...`);
      return printImageViaPowerShell(filePath, printerName, options);
    } catch (gdiErr) {
      console.warn(`[PrinterAdapter] Engine 2 (GDI) failed:`, gdiErr.message);
    }
  }

  // Engine 2: Headless Microsoft Edge for PDFs
  if (!isImage) {
    try {
      console.log(`[PrinterAdapter] Attempting Engine 2: Headless Microsoft Edge for PDF...`);
      return printPdfViaEdge(filePath, printerName);
    } catch (edgeErr) {
      console.warn(`[PrinterAdapter] Engine 2 (Edge) failed:`, edgeErr.message);
    }
  }

  // Engine 3: Native Windows Shell PrintTo verb fallback
  console.log(`[PrinterAdapter] Attempting Engine 3: Windows Shell PrintTo verb fallback...`);
  try {
    const escapedFile = filePath.replace(/'/g, "''");
    const escapedPrinter = printerName.replace(/'/g, "''");
    const psScript = `Start-Process -FilePath '${escapedFile}' -Verb PrintTo -ArgumentList '"${escapedPrinter}"' -PassThru | Wait-Process -Timeout 20`;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      timeout: 25000
    });

    console.log(`[PrinterAdapter] ✓ Shell PrintTo successfully dispatched to "${printerName}"!`);
    return { success: true, method: 'powershell-verb' };
  } catch (shellErr) {
    throw new Error(`All print spooling engines failed for "${printerName}": ${shellErr.message}`);
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
      return rawPrinters.map(p => {
        const isVirtual = /pdf|onenote|xps|fax|writer|document/i.test(p.name);
        return {
          name: p.name,
          displayName: p.displayName || p.name,
          description: p.description || '',
          status: p.status,
          isDefault: Boolean(p.isDefault),
          isVirtual,
          options: {
            color: true,
            duplex: true,
            paperSizes: ['A4', 'A3', 'Letter', 'Legal']
          }
        };
      });
    } catch (err) {
      console.error('[PrinterAdapter] Failed to enumerate printers:', err);
      return [];
    }
  }

  async resolveTargetPrinter(requestedName) {
    const printers = await this.getPrinters();
    if (!printers || printers.length === 0) {
      return {
        printerName: requestedName || 'Microsoft Print to PDF',
        isVirtual: true,
        exists: false
      };
    }

    const cleanReq = (requestedName || '').trim();

    // 1. Direct match (case-insensitive)
    if (cleanReq && cleanReq.toLowerCase() !== 'default' && cleanReq.toLowerCase() !== 'default counter printer') {
      const direct = printers.find(p => p.name.toLowerCase() === cleanReq.toLowerCase());
      if (direct) {
        return {
          printerName: direct.name,
          isVirtual: direct.isVirtual,
          exists: true
        };
      }
      // Substring match (e.g. "Canon" matches "Canon LBP2900")
      const sub = printers.find(p => p.name.toLowerCase().includes(cleanReq.toLowerCase()));
      if (sub) {
        return {
          printerName: sub.name,
          isVirtual: sub.isVirtual,
          exists: true
        };
      }
    }

    // 2. Fallback to physical default printer if one exists
    const defaultPrinter = printers.find(p => p.isDefault);
    const physicalDefault = printers.find(p => p.isDefault && !p.isVirtual);
    const firstPhysical = printers.find(p => !p.isVirtual);

    const chosen = physicalDefault || defaultPrinter || firstPhysical || printers[0];

    return {
      printerName: chosen.name,
      isVirtual: chosen.isVirtual,
      exists: true,
      autoResolved: true
    };
  }

  generateTestPage(printerName) {
    try {
      const testPath = path.join(os.tmpdir(), `printease_test_${Date.now()}.png`);
      const escapedPath = testPath.replace(/'/g, "''");
      const escapedPrinter = (printerName || 'Default Printer').replace(/'/g, "''");

      const script = [
        'Add-Type -AssemblyName System.Drawing',
        `$testPath = '${escapedPath}'`,
        `$printerName = '${escapedPrinter}'`,
        '$bmp = New-Object System.Drawing.Bitmap 1200, 1600',
        '$g = [System.Drawing.Graphics]::FromImage($bmp)',
        '$g.Clear([System.Drawing.Color]::White)',
        '$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias',
        '$headerBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 79, 70, 229))',
        '$g.FillRectangle($headerBrush, 60, 60, 1080, 140)',
        '$fontTitle = New-Object System.Drawing.Font("Arial", 28, [System.Drawing.FontStyle]::Bold)',
        '$fontSub = New-Object System.Drawing.Font("Arial", 14, [System.Drawing.FontStyle]::Regular)',
        '$fontBody = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Regular)',
        '$fontBold = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Bold)',
        '$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)',
        '$blackBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))',
        '$g.DrawString("PrintEase Desktop Agent", $fontTitle, $whiteBrush, 90, 85)',
        '$g.DrawString("HARDWARE PRINTER & SPOOLER TEST PAGE", $fontSub, $whiteBrush, 90, 140)',
        '$g.DrawString("Target Printer:", $fontBold, $blackBrush, 90, 240)',
        '$g.DrawString($printerName, $fontBody, $blackBrush, 320, 240)',
        '$g.DrawString("Timestamp:", $fontBold, $blackBrush, 90, 280)',
        '$g.DrawString((Get-Date).ToString("dd-MMM-yyyy HH:mm:ss"), $fontBody, $blackBrush, 320, 280)',
        '$g.DrawString("Machine Host:", $fontBold, $blackBrush, 90, 320)',
        '$g.DrawString($env:COMPUTERNAME, $fontBody, $blackBrush, 320, 320)',
        '$g.DrawString("Windows OS:", $fontBold, $blackBrush, 90, 360)',
        '$g.DrawString((Get-CimInstance Win32_OperatingSystem).Caption, $fontBody, $blackBrush, 320, 360)',
        '$colors = @([System.Drawing.Color]::Cyan, [System.Drawing.Color]::Magenta, [System.Drawing.Color]::Yellow, [System.Drawing.Color]::Black, [System.Drawing.Color]::FromArgb(255, 16, 185, 129), [System.Drawing.Color]::FromArgb(255, 79, 70, 229))',
        '$x = 90',
        'for ($i = 0; $i -lt $colors.Length; $i++) {',
        '    $sb = New-Object System.Drawing.SolidBrush $colors[$i]',
        '    $g.FillRectangle($sb, $x, 430, 160, 60)',
        '    $g.DrawRectangle([System.Drawing.Pens]::Black, $x, 430, 160, 60)',
        '    $x += 180',
        '}',
        '$successBg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 236, 253, 245))',
        '$g.FillRectangle($successBg, 90, 530, 1020, 120)',
        '$g.DrawRectangle([System.Drawing.Pens]::MediumSeaGreen, 90, 530, 1020, 120)',
        '$greenBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 6, 95, 70))',
        '$g.DrawString("✓ HARDWARE SPOOLER CONNECTION SUCCESSFUL", $fontBold, $greenBrush, 120, 555)',
        '$g.DrawString("If this page printed onto physical paper, your printer driver, Windows spooler,", $fontSub, $greenBrush, 120, 590)',
        '$g.DrawString("and PrintEase background daemon are 100% operational and ready to process orders.", $fontSub, $greenBrush, 120, 615)',
        '$g.Dispose()',
        '$bmp.Save($testPath, [System.Drawing.Imaging.ImageFormat]::Png)',
        '$bmp.Dispose()'
      ].join('\r\n');

      const encoded = Buffer.from(script, 'utf16le').toString('base64');
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
        windowsHide: true,
        timeout: 10000
      });

      return testPath;
    } catch (err) {
      console.error('[PrinterAdapter] Failed to generate test page:', err);
      return null;
    }
  }

  async printJob(filePath, options = {}) {
    const rawTargetName = options.printerName || 'Default';
    const resolution = await this.resolveTargetPrinter(rawTargetName);
    const printerName = resolution.printerName;
    const isPdfPrinter = resolution.isVirtual;

    console.log(`[PrinterAdapter] Queuing print job for file: ${filePath}`);
    console.log(`[PrinterAdapter] Resolved printer: "${printerName}" (Virtual/Folder mode: ${isPdfPrinter})`);

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
      console.log(`[PrinterAdapter] Virtual PDF printer detected (${printerName}). Document preserved in output folder.`);
      return {
        success: true,
        jobId: `pdf-save-${Date.now()}`,
        status: 'SAVED_TO_DESKTOP',
        printer: printerName,
        savedPath: destPath
      };
    }

    // 2. Real Physical hardware printer spooling
    console.log(`[PrinterAdapter] Spooling document to physical printer: "${printerName}"...`);
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
    const found = printers.find(p => p.name.toLowerCase() === (printerName || '').toLowerCase());
    return found ? { status: 'ONLINE', ready: true, isVirtual: found.isVirtual } : { status: 'UNKNOWN', ready: false };
  }
}

module.exports = {
  BasePrinterAdapter,
  WindowsPrinterAdapter
};
