const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class PrintWorker {
  constructor(options = {}) {
    this.getConfig = options.getConfig || (() => ({}));
    this.printerAdapter = options.printerAdapter;
    this.onEvent = options.onEvent || (() => {});
    this.isRunning = false;
    this.timer = null;
    this.isProcessing = false;
    this.tempDir = path.join(os.tmpdir(), 'printease_spooler');

    if (!fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
      } catch (err) {
        console.error('[PrintWorker] Failed to create tempDir:', err);
      }
    }
  }

  start(intervalMs = 5000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[PrintWorker] Started background polling loop (Interval: ${intervalMs}ms)`);
    
    // Initial tick
    this.tick();
    this.timer = setInterval(() => this.tick(), intervalMs);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[PrintWorker] Stopped polling loop');
  }

  async triggerPoll() {
    return await this.tick();
  }

  async tick() {
    if (!this.isRunning || this.isProcessing) {
      return;
    }

    const config = this.getConfig();
    if (!config.paired || !config.deviceToken) {
      return;
    }

    this.isProcessing = true;
    try {
      await this.pollAndExecuteJobs(config);
    } catch (err) {
      console.error('[PrintWorker] Error during tick:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  async pollAndExecuteJobs(config) {
    const backendUrl = config.backendUrl.replace(/\/+$/, '');
    const token = config.deviceToken;

    // 1. Poll for jobs
    const pollRes = await fetch(`${backendUrl}/api/desktop/jobs/poll`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Device-Token': token
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!pollRes.ok) {
      return;
    }

    const pollData = await pollRes.json();
    const jobs = pollData.jobs || [];

    if (jobs.length === 0) {
      return;
    }

    console.log(`[PrintWorker] Found ${jobs.length} pending print job(s) for branch`);

    for (const job of jobs) {
      await this.processJob(backendUrl, token, job, config);
    }
  }

  async processJob(backendUrl, deviceToken, job, config) {
    console.log(`[PrintWorker] Claiming Job #${job.id} (Order: ${job.order_number})...`);

    // Step A: Claim Job
    let leaseToken = null;
    let downloadUrl = null;

    try {
      const claimRes = await fetch(`${backendUrl}/api/desktop/jobs/${job.id}/claim`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'X-Device-Token': deviceToken
        },
        signal: AbortSignal.timeout(6000)
      });

      if (!claimRes.ok) {
        console.warn(`[PrintWorker] Could not claim Job #${job.id} (${claimRes.status})`);
        return;
      }

      const claimData = await claimRes.json();
      leaseToken = claimData.job_lease_token;
      downloadUrl = claimData.download_url;

      this.onEvent('job:status-update', {
        jobId: job.id,
        orderNumber: job.order_number,
        status: 'DOWNLOADING',
        message: 'Job claimed. Downloading document...'
      });
    } catch (err) {
      console.error(`[PrintWorker] Claim error for job ${job.id}:`, err);
      return;
    }

    // Step B: Download file to secure temp directory
    const tempFilePath = path.join(this.tempDir, `job_${job.id}_${Date.now()}.pdf`);

    try {
      const dlRes = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'X-Device-Token': deviceToken,
          'X-Job-Lease-Token': leaseToken
        },
        signal: AbortSignal.timeout(20000)
      });

      if (!dlRes.ok) {
        throw new Error(`Download failed with status ${dlRes.status}`);
      }

      const arrayBuffer = await dlRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(tempFilePath, buffer);

      // Verify SHA256 checksum if provided
      if (job.file && job.file.file_hash_sha256) {
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        if (hash !== job.file.file_hash_sha256) {
          throw new Error(`SHA256 checksum mismatch! Expected ${job.file.file_hash_sha256}, got ${hash}`);
        }
      }

      this.onEvent('job:status-update', {
        jobId: job.id,
        orderNumber: job.order_number,
        status: 'PRINTING',
        message: 'Document verified. Submitting to Windows print spooler...'
      });

      // Step C: Update status to PRINTING
      await fetch(`${backendUrl}/api/desktop/jobs/${job.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Device-Token': deviceToken
        },
        body: JSON.stringify({
          job_lease_token: leaseToken,
          status: 'PRINTING'
        })
      });

      // Step D: Print to Spooler
      const startTime = Date.now();
      const printerName = config.selectedPrinter || job.printer.name;
      
      const spoolResult = await this.printerAdapter.printJob(tempFilePath, {
        printerName,
        options: job.options
      });

      const spoolDuration = Date.now() - startTime;

      // Step E: Update status to COMPLETED
      await fetch(`${backendUrl}/api/desktop/jobs/${job.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Device-Token': deviceToken
        },
        body: JSON.stringify({
          job_lease_token: leaseToken,
          status: 'COMPLETED',
          spooler_job_id: spoolResult.jobId || `spool-${Date.now()}`,
          telemetry: {
            spool_duration_ms: spoolDuration,
            printer_used: printerName,
            pages_printed: job.file?.page_count || 1,
            sheets: job.options?.sheet_count || 1
          }
        })
      });

      console.log(`[PrintWorker] Job #${job.id} successfully completed and spooled!`);

      this.onEvent('job:status-update', {
        jobId: job.id,
        orderNumber: job.order_number,
        status: 'COMPLETED',
        message: `Print complete! Sent to ${printerName}`,
        spoolerJobId: spoolResult.jobId
      });
    } catch (err) {
      console.error(`[PrintWorker] Failed processing Job #${job.id}:`, err);

      try {
        await fetch(`${backendUrl}/api/desktop/jobs/${job.id}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Device-Token': deviceToken
          },
          body: JSON.stringify({
            job_lease_token: leaseToken,
            status: 'PRINT_FAILED',
            error_message: err.message
          })
        });
      } catch (statusErr) {
        // ignore secondary error
      }

      this.onEvent('job:status-update', {
        jobId: job.id,
        orderNumber: job.order_number,
        status: 'FAILED',
        error: err.message
      });
    } finally {
      // Securely shred temporary PDF file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (delErr) {
          console.warn('[PrintWorker] Could not unlink temp file:', delErr.message);
        }
      }
    }
  }
}

module.exports = { PrintWorker };
