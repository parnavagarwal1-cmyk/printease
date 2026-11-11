document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupEventListeners();

  await loadAppInfo();
  await refreshBackendStatus();
  await scanPrinters();
  await loadRecentJobs();

  // Listen for real-time print events from background worker
  if (window.electronAPI.onJobStatusUpdate) {
    window.electronAPI.onJobStatusUpdate((event) => {
      handleLiveJobEvent(event);
    });
  }
});

function setupTabs() {
  const tabs = document.querySelectorAll('.nav-item');
  const panes = document.querySelectorAll('.tab-pane');
  const title = document.getElementById('page-title');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const target = tab.getAttribute('data-tab');
      const pane = document.getElementById(`pane-${target}`);
      if (pane) pane.classList.add('active');

      if (target === 'status') title.textContent = 'Desktop Agent Spooler';
      if (target === 'queue') title.textContent = 'Print Spooler Queue';
      if (target === 'printers') title.textContent = 'Installed Windows Printers';
      if (target === 'pairing') title.textContent = 'Device Pairing & Security';
    });
  });
}

function setupEventListeners() {
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    await refreshBackendStatus();
    await scanPrinters();
    await loadRecentJobs();
  });

  const btnPoll = document.getElementById('btn-poll-now');
  if (btnPoll) {
    btnPoll.addEventListener('click', async () => {
      btnPoll.disabled = true;
      btnPoll.innerHTML = '<span>Polling...</span>';
      try {
        await window.electronAPI.pollNow();
        await loadRecentJobs();
      } catch (err) {
        console.error('Manual poll error:', err);
      } finally {
        btnPoll.disabled = false;
        btnPoll.innerHTML = '<span>Poll Jobs Now</span>';
      }
    });
  }

  document.getElementById('btn-rescan-printers').addEventListener('click', async () => {
    await scanPrinters();
  });

  document.getElementById('btn-pair').addEventListener('click', async () => {
    const backendInput = document.getElementById('input-backend-url');
    const input = document.getElementById('input-pairing-code');
    const resultBox = document.getElementById('pairing-result');
    const code = input.value.trim();
    const backendUrl = (backendInput ? backendInput.value.trim() : '') || 'https://printease-production-7b9f.up.railway.app';

    if (!code) {
      resultBox.innerHTML = '<span style="color:#EF4444; font-size:12px;">Please enter a pairing code.</span>';
      return;
    }

    resultBox.innerHTML = '<span style="color:#64748B; font-size:12px;">Connecting to PrintEase cloud (' + escapeHtml(backendUrl) + ')...</span>';
    
    // Save backend URL into device config
    await window.electronAPI.saveDeviceConfig({ backendUrl });

    const res = await window.electronAPI.pairDevice(code);
    if (res.success) {
      resultBox.innerHTML = `<span style="color:#10B981; font-weight:600; font-size:12px;">✓ ${res.message}</span>`;
      document.getElementById('val-device-state').textContent = 'Paired & Online';
      document.getElementById('val-device-state').style.color = '#10B981';
      document.getElementById('val-device-sub').textContent = res.branch ? `${res.branch.name} (${res.branch.shop_name})` : 'Active';
      document.getElementById('info-branch').textContent = res.branch ? `${res.branch.name} (${res.branch.shop_name})` : 'Paired';
      await refreshBackendStatus();
      await loadRecentJobs();
    } else {
      resultBox.innerHTML = `<span style="color:#EF4444; font-size:12px;">✗ ${res.message}</span>`;
    }
  });
}

async function loadAppInfo() {
  try {
    const info = await window.electronAPI.getAppVersion();
    document.getElementById('info-electron').textContent = info.electron;
    document.getElementById('info-node').textContent = info.node;
    document.getElementById('info-platform').textContent = `${info.platform} (${info.arch})`;

    const config = await window.electronAPI.getDeviceConfig();
    const backendInput = document.getElementById('input-backend-url');
    if (backendInput && config && config.backendUrl) {
      backendInput.value = config.backendUrl;
    }
    const valBackendSub = document.getElementById('val-backend-sub');
    if (valBackendSub && config && config.backendUrl) {
      valBackendSub.textContent = config.backendUrl;
    }
    if (config && config.paired) {
      const stateEl = document.getElementById('val-device-state');
      const subEl = document.getElementById('val-device-sub');
      const infoBranch = document.getElementById('info-branch');
      if (stateEl) {
        stateEl.textContent = 'Paired & Online';
        stateEl.style.color = '#10B981';
      }
      const branchDisplay = config.branchName ? `${config.branchName} (${config.shopName || 'Shop'})` : 'Active';
      if (subEl) subEl.textContent = branchDisplay;
      if (infoBranch) infoBranch.textContent = branchDisplay;
    }

    const infoPrinter = document.getElementById('info-selected-printer');
    if (infoPrinter && config) {
      infoPrinter.textContent = config.selectedPrinter || 'Default Windows Printer';
    }
  } catch (err) {
    console.error('Failed to get app version:', err);
  }
}

async function refreshBackendStatus() {
  const sidebarBadge = document.getElementById('sidebar-connection');
  const valBackendStatus = document.getElementById('val-backend-status');
  const valDbStatus = document.getElementById('val-db-status');
  const infoLaravel = document.getElementById('info-laravel');
  const infoPhp = document.getElementById('info-php');

  valBackendStatus.textContent = 'Testing...';

  try {
    const config = await window.electronAPI.getDeviceConfig();
    const targetUrl = (config && config.backendUrl) ? config.backendUrl : 'https://printease-production-7b9f.up.railway.app';
    const valBackendSub = document.getElementById('val-backend-sub');
    if (valBackendSub) {
      valBackendSub.textContent = targetUrl;
    }
    const health = await window.electronAPI.checkHealth(targetUrl);
    if (health.ok && health.data) {
      sidebarBadge.innerHTML = '<span class="status-dot online"></span><span class="status-label" style="color:#065F46; font-weight:600;">Cloud Online</span>';
      valBackendStatus.textContent = 'Connected';
      valBackendStatus.style.color = '#10B981';

      valDbStatus.textContent = health.data.services.database.status === 'connected' ? 'Connected' : 'Degraded';
      valDbStatus.style.color = health.data.services.database.status === 'connected' ? '#10B981' : '#EF4444';

      infoLaravel.textContent = health.data.app.laravel;
      infoPhp.textContent = health.data.app.php;
    } else {
      sidebarBadge.innerHTML = '<span class="status-dot offline"></span><span class="status-label" style="color:#991B1B;">Backend Offline</span>';
      valBackendStatus.textContent = 'Offline';
      valBackendStatus.style.color = '#EF4444';
      valDbStatus.textContent = 'Unreachable';
      valDbStatus.style.color = '#EF4444';
    }
  } catch (err) {
    sidebarBadge.innerHTML = '<span class="status-dot offline"></span><span class="status-label" style="color:#991B1B;">Error</span>';
    valBackendStatus.textContent = 'Error';
    valBackendStatus.style.color = '#EF4444';
  }
}

async function scanPrinters() {
  const container = document.getElementById('printer-list');
  const countLabel = document.getElementById('val-printers-count');
  container.innerHTML = '<div style="color:#64748B; font-size:12px;">Enumerating Windows printers...</div>';

  try {
    const config = await window.electronAPI.getDeviceConfig();
    const currentSelected = (config && config.selectedPrinter) ? config.selectedPrinter : null;
    const printers = await window.electronAPI.getPrinters();
    countLabel.textContent = printers.length;

    if (printers.length === 0) {
      container.innerHTML = '<div style="color:#64748B; font-size:12px; padding:12px;">No Windows printers found on this system.</div>';
      return;
    }

    // Determine effectively active printer
    const activePrinterName = currentSelected || (printers.find(p => p.isDefault)?.name) || printers[0].name;

    const banner = document.getElementById('selected-printer-banner');
    if (banner) {
      banner.style.display = 'flex';
      banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:15px;">🖨️</span>
          <span>Active Spooler Hardware: <strong style="color:#1E1B4B; font-weight:700;">${escapeHtml(activePrinterName)}</strong></span>
        </div>
        <span class="badge badge-success" style="font-size:11px; padding:3px 10px;">Ready for Auto-Spooling</span>
      `;
    }

    container.innerHTML = '';
    printers.forEach(printer => {
      const isSelected = (currentSelected ? currentSelected === printer.name : Boolean(printer.isDefault));
      const card = document.createElement('div');
      card.className = `printer-card ${isSelected ? 'selected' : ''}`;
      card.innerHTML = `
        <div>
          <div class="printer-info-name" style="display:flex; align-items:center; gap:6px;">
            <span style="font-weight:700; color:${isSelected ? '#1E1B4B' : '#0F172A'};">${escapeHtml(printer.name)}</span>
            ${printer.isDefault ? '<span class="badge badge-success" style="font-size:10px;">Default</span>' : ''}
            ${isSelected ? '<span class="badge badge-primary" style="font-size:10px; font-weight:700;">✓ Active Spooler</span>' : ''}
          </div>
          <div class="printer-info-detail">${escapeHtml(printer.displayName || printer.description || 'System Printer')}</div>
        </div>
        <div>
          ${isSelected 
            ? '<button class="btn btn-sm" style="background:#10B981; color:white; border:none; cursor:default; font-weight:600; padding:6px 14px; border-radius:6px;" disabled>✓ Selected</button>'
            : `<button class="btn btn-secondary btn-sm" style="cursor:pointer; padding:6px 14px; border-radius:6px;" onclick="selectPrinter('${escapeHtml(printer.name)}')">Select</button>`
          }
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div style="color:#EF4444; font-size:12px;">Failed to scan printers: ${err.message}</div>`;
  }
}

async function loadRecentJobs() {
  const feed = document.getElementById('spooler-feed');
  if (!feed || !window.electronAPI.getRecentJobs) return;

  try {
    const jobs = await window.electronAPI.getRecentJobs();
    if (!jobs || jobs.length === 0) {
      feed.innerHTML = '<div class="empty-state">No print jobs received yet. Polling branch queue...</div>';
      return;
    }

    feed.innerHTML = '';
    jobs.forEach(job => {
      feed.appendChild(createJobElement(job));
    });
  } catch (err) {
    console.error('Error loading recent jobs:', err);
  }
}

function handleLiveJobEvent(event) {
  const feed = document.getElementById('spooler-feed');
  if (!feed) return;

  const emptyMsg = document.getElementById('empty-feed-msg');
  if (emptyMsg) emptyMsg.remove();

  // Prepend new live event to top of feed
  const element = createJobElement(event);
  feed.insertBefore(element, feed.firstChild);
}

function createJobElement(job) {
  const div = document.createElement('div');
  div.style.cssText = 'padding: 12px; border: 1px solid #E2E8F0; border-radius: 8px; margin-bottom: 8px; background: white; display: flex; justify-content: space-between; align-items: center;';

  const statusColor = job.status === 'COMPLETED' ? '#10B981' : (job.status === 'FAILED' ? '#EF4444' : '#6366F1');
  const timeStr = job.timestamp ? new Date(job.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();

  div.innerHTML = `
    <div>
      <div style="font-weight: 700; font-size: 13px; color: #0F172A;">
        Job #${job.jobId} <span style="font-weight: 400; color: #64748B;">(${escapeHtml(job.orderNumber || 'Order')})</span>
      </div>
      <div style="font-size: 11px; color: #64748B; margin-top: 2px;">
        ${escapeHtml(job.message || job.status)} ${job.spoolerJobId ? `• Spooler Ref: ${job.spoolerJobId}` : ''}
      </div>
    </div>
    <div style="text-align: right;">
      <span style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; background: ${statusColor}15; color: ${statusColor}; text-transform: uppercase;">
        ${escapeHtml(job.status)}
      </span>
      <div style="font-size: 10px; color: #94A3B8; margin-top: 4px;">${timeStr}</div>
    </div>
  `;

  return div;
}

window.selectPrinter = async function(printerName) {
  try {
    const res = await window.electronAPI.saveDeviceConfig({ selectedPrinter: printerName });
    if (res && res.success) {
      await scanPrinters();
      
      const infoPrinter = document.getElementById('info-selected-printer');
      if (infoPrinter) {
        infoPrinter.textContent = printerName;
      }
    }
  } catch (err) {
    console.error('Failed to select printer:', err);
    alert('Failed to select printer: ' + err.message);
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
