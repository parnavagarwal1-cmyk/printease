document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupEventListeners();

  await loadAppInfo();
  await refreshBackendStatus();
  await scanPrinters();
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
      document.getElementById(`pane-${target}`).classList.add('active');

      if (target === 'status') title.textContent = 'Desktop Agent Spooler';
      if (target === 'printers') title.textContent = 'Installed Windows Printers';
      if (target === 'pairing') title.textContent = 'Device Pairing & Security';
    });
  });
}

function setupEventListeners() {
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    await refreshBackendStatus();
    await scanPrinters();
  });

  document.getElementById('btn-rescan-printers').addEventListener('click', async () => {
    await scanPrinters();
  });

  document.getElementById('btn-pair').addEventListener('click', async () => {
    const input = document.getElementById('input-pairing-code');
    const resultBox = document.getElementById('pairing-result');
    const code = input.value.trim();

    if (!code) {
      resultBox.innerHTML = '<span style="color:#EF4444; font-size:12px;">Please enter a pairing code.</span>';
      return;
    }

    resultBox.innerHTML = '<span style="color:#64748B; font-size:12px;">Connecting to PrintEase cloud...</span>';
    const res = await window.electronAPI.pairDevice(code);
    if (res.success) {
      resultBox.innerHTML = `<span style="color:#10B981; font-weight:600; font-size:12px;">✓ ${res.message}</span>`;
      document.getElementById('val-device-state').textContent = 'Paired & Online';
      document.getElementById('val-device-state').style.color = '#10B981';
      document.getElementById('val-device-sub').textContent = res.branch ? `${res.branch.name} (${res.branch.shop_name})` : 'Active';
      document.getElementById('info-branch').textContent = res.branch ? `${res.branch.name} (${res.branch.shop_name})` : 'Paired';
      await refreshBackendStatus();
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
    const health = await window.electronAPI.checkHealth('http://127.0.0.1:8000');
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
    const printers = await window.electronAPI.getPrinters();
    countLabel.textContent = printers.length;

    if (printers.length === 0) {
      container.innerHTML = '<div style="color:#64748B; font-size:12px; padding:12px;">No Windows printers found on this system.</div>';
      return;
    }

    container.innerHTML = '';
    printers.forEach(printer => {
      const card = document.createElement('div');
      card.className = 'printer-card';
      card.innerHTML = `
        <div>
          <div class="printer-info-name">${escapeHtml(printer.name)} ${printer.isDefault ? '<span class="badge badge-success" style="margin-left:6px;">Default</span>' : ''}</div>
          <div class="printer-info-detail">${escapeHtml(printer.displayName || printer.description || 'System Printer')}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="selectPrinter('${escapeHtml(printer.name)}')">Select</button>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<div style="color:#EF4444; font-size:12px;">Failed to scan printers: ${err.message}</div>`;
  }
}

window.selectPrinter = function(printerName) {
  alert(`Selected default printer: ${printerName}`);
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
