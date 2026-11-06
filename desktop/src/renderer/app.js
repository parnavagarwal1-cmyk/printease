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

window.selectPrinter = function(printerName) {
  alert(`Selected default printer: ${printerName}`);
};

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
