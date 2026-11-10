<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DesktopDevice;
use App\Models\PrintJob;
use App\Models\PrintJobAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DesktopJobController extends Controller
{
    /**
     * Poll ready print jobs for paired desktop agent's branch.
     */
    public function pollJobs(Request $request): JsonResponse
    {
        $device = $this->authenticateDevice($request);
        if (!$device) {
            return response()->json(['message' => 'Unauthorized device'], 401);
        }

        // Fetch jobs ready for printing or expired stale leases
        $jobs = PrintJob::whereHas('order', function ($q) use ($device) {
            $q->where('branch_id', $device->branch_id);
        })
        ->where(function ($q) {
            $q->where('status', 'PRINT_QUEUED')
              ->orWhere(function ($sub) {
                  $sub->whereIn('status', ['DOWNLOADING', 'PRINTING'])
                      ->where('leased_until', '<', now());
              });
        })
        ->with(['order.files', 'order.items', 'printer'])
        ->orderBy('created_at', 'asc')
        ->limit(10)
        ->get();

        $formatted = $jobs->map(function ($job) {
            $firstFile = $job->order->files->first();
            $firstItem = $job->order->items->first();

            return [
                'id' => $job->id,
                'order_id' => $job->order_id,
                'order_number' => $job->order->order_number,
                'customer_name' => $job->order->customer_name,
                'customer_phone' => $job->order->customer_phone,
                'status' => $job->status,
                'created_at' => $job->created_at->toIso8601String(),
                'printer' => [
                    'id' => $job->printer->id,
                    'name' => $job->printer->name,
                    'model' => $job->printer->model,
                ],
                'file' => $firstFile ? [
                    'id' => $firstFile->id,
                    'original_filename' => $firstFile->original_filename,
                    'file_size_bytes' => $firstFile->file_size_bytes,
                    'page_count' => $firstFile->page_count,
                    'file_hash_sha256' => $firstFile->file_hash_sha256,
                ] : null,
                'options' => $firstItem ? [
                    'paper_size' => $firstItem->paper_size,
                    'print_mode' => $firstItem->print_mode,
                    'duplex_mode' => $firstItem->duplex_mode,
                    'copies' => $firstItem->copies,
                    'page_range' => $firstItem->page_range,
                    'sheet_count' => $firstItem->sheet_count,
                ] : [
                    'paper_size' => 'A4',
                    'print_mode' => 'bw',
                    'duplex_mode' => 'single',
                    'copies' => 1,
                    'page_range' => 'all',
                    'sheet_count' => 1,
                ],
            ];
        });

        return response()->json([
            'jobs' => $formatted,
            'count' => $formatted->count(),
            'branch_id' => $device->branch_id,
        ]);
    }

    /**
     * Atomically claim a print job with multi-device lease-lock.
     */
    public function claimJob(Request $request, int $id): JsonResponse
    {
        $device = $this->authenticateDevice($request);
        if (!$device) {
            return response()->json(['message' => 'Unauthorized device'], 401);
        }

        return DB::transaction(function () use ($device, $id, $request) {
            $job = PrintJob::where('id', $id)
                ->whereHas('order', function ($q) use ($device) {
                    $q->where('branch_id', $device->branch_id);
                })
                ->lockForUpdate()
                ->first();

            if (!$job) {
                return response()->json(['message' => 'Print job not found for this branch'], 404);
            }

            // Check if claimable: PRINT_QUEUED or expired lease
            $isClaimable = ($job->status === 'PRINT_QUEUED') ||
                ($job->leased_until && $job->leased_until->isPast());

            if (!$isClaimable && $job->claimed_by_device_id !== $device->id) {
                return response()->json([
                    'message' => 'Conflict: Print job is already leased to another device',
                    'claimed_by_device_id' => $job->claimed_by_device_id,
                    'leased_until' => $job->leased_until?->toIso8601String(),
                ], 409);
            }

            $leaseToken = 'lease_' . Str::random(48);
            $leasedUntil = now()->addSeconds(120); // 2-minute execution window

            $job->update([
                'claimed_by_device_id' => $device->id,
                'job_lease_token' => $leaseToken,
                'leased_until' => $leasedUntil,
                'status' => 'DOWNLOADING',
            ]);

            AuditLog::create([
                'shop_id' => $device->branch->shop_id,
                'action' => 'job_claimed_by_desktop',
                'entity_type' => 'print_job',
                'entity_id' => $job->id,
                'ip_address' => $request->ip(),
                'details' => [
                    'device_id' => $device->id,
                    'device_name' => $device->device_name,
                    'leased_until' => $leasedUntil->toIso8601String(),
                ],
            ]);

            return response()->json([
                'message' => 'Print job claimed successfully',
                'job_id' => $job->id,
                'job_lease_token' => $leaseToken,
                'leased_until' => $leasedUntil->toIso8601String(),
                'download_url' => url("/api/desktop/jobs/{$job->id}/download?lease_token={$leaseToken}"),
            ]);
        });
    }

    /**
     * Download document file with valid lease lock.
     */
    public function downloadFile(Request $request, int $id)
    {
        $device = $this->authenticateDevice($request);
        if (!$device) {
            return response()->json(['message' => 'Unauthorized device'], 401);
        }

        $leaseToken = $request->header('X-Job-Lease-Token') ?? $request->query('lease_token');
        if (empty($leaseToken)) {
            return response()->json(['message' => 'Missing job lease token'], 403);
        }

        $job = PrintJob::where('id', $id)
            ->whereHas('order', function ($q) use ($device) {
                $q->where('branch_id', $device->branch_id);
            })
            ->with(['order.files'])
            ->first();

        if (!$job) {
            return response()->json(['message' => 'Job not found'], 404);
        }

        // Validate active lease
        if ($job->job_lease_token !== $leaseToken || $job->claimed_by_device_id !== $device->id) {
            return response()->json(['message' => 'Forbidden: Invalid lease token or wrong device'], 403);
        }

        if ($job->leased_until && $job->leased_until->isPast()) {
            return response()->json(['message' => 'Forbidden: Job lease has expired'], 403);
        }

        $file = $job->order->files->first();
        if (!$file || !Storage::disk('local')->exists($file->storage_path)) {
            return response()->json(['message' => 'Document file not found in storage'], 404);
        }

        // Mark downloaded timestamp
        $job->update(['downloaded_at' => now()]);

        return Storage::disk('local')->response(
            $file->storage_path,
            $file->original_filename,
            [
                'Content-Type' => $file->mime_type ?: 'application/octet-stream',
                'X-File-SHA256' => $file->file_hash_sha256,
            ]
        );
    }

    /**
     * Update job status and record execution telemetry.
     */
    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $device = $this->authenticateDevice($request);
        if (!$device) {
            return response()->json(['message' => 'Unauthorized device'], 401);
        }

        $validated = $request->validate([
            'job_lease_token' => ['required', 'string'],
            'status' => ['required', 'in:DOWNLOADING,PRINTING,SUBMITTED_TO_SPOOLER,COMPLETED,PRINT_FAILED'],
            'spooler_job_id' => ['nullable', 'string', 'max:64'],
            'error_message' => ['nullable', 'string', 'max:1000'],
            'telemetry' => ['nullable', 'array'],
        ]);

        $job = PrintJob::where('id', $id)
            ->whereHas('order', function ($q) use ($device) {
                $q->where('branch_id', $device->branch_id);
            })
            ->with(['order'])
            ->first();

        if (!$job) {
            return response()->json(['message' => 'Job not found'], 404);
        }

        // Check lease token ownership
        if ($job->job_lease_token !== $validated['job_lease_token'] || $job->claimed_by_device_id !== $device->id) {
            return response()->json(['message' => 'Forbidden: Lease token mismatch'], 403);
        }

        $status = $validated['status'];
        $updates = ['status' => $status];

        if ($status === 'SUBMITTED_TO_SPOOLER') {
            $updates['spooled_at'] = now();
            if (!empty($validated['spooler_job_id'])) {
                $updates['spooler_job_id'] = $validated['spooler_job_id'];
            }
        } elseif ($status === 'COMPLETED') {
            $updates['completed_at'] = now();
        }

        $job->update($updates);

        // Record telemetry attempt
        $attemptNum = ($job->attempts()->max('attempt_number') ?? 0) + 1;
        $attemptStatus = in_array($status, ['COMPLETED', 'SUBMITTED_TO_SPOOLER']) ? 'SUCCESS' : ($status === 'PRINT_FAILED' ? 'FAILED' : 'IN_PROGRESS');

        PrintJobAttempt::create([
            'print_job_id' => $job->id,
            'device_id' => $device->id,
            'attempt_number' => $attemptNum,
            'status' => $attemptStatus,
            'error_message' => $validated['error_message'] ?? null,
            'telemetry' => $validated['telemetry'] ?? null,
        ]);

        // If job completed, update parent order status and purge cloud document
        if ($status === 'COMPLETED') {
            $allJobsComplete = !PrintJob::where('order_id', $job->order_id)
                ->where('status', '!=', 'COMPLETED')
                ->exists();

            if ($allJobsComplete) {
                $job->order->update(['status' => 'COMPLETED']);
                // Zero-retention cloud hygiene: permanently delete customer documents immediately
                $job->order->purgeFiles();
            }
        }

        return response()->json([
            'message' => 'Status updated successfully',
            'job' => $job->fresh(),
        ]);
    }

    /**
     * Authenticate device via hashed secret token.
     */
    private function authenticateDevice(Request $request): ?DesktopDevice
    {
        $token = $request->header('X-Device-Token');
        if (!$token) {
            return null;
        }

        $tokenHash = hash('sha256', $token);
        return DesktopDevice::where('auth_token_hash', $tokenHash)
            ->with(['branch'])
            ->first();
    }
}
