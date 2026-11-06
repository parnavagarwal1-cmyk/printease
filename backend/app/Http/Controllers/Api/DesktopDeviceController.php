<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DesktopDevice;
use App\Models\Printer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DesktopDeviceController extends Controller
{
    /**
     * Pair Windows Desktop Device using secure code
     */
    public function pair(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pairing_code' => ['required', 'string'],
            'device_name' => ['required', 'string', 'max:255'],
            'device_uuid' => ['required', 'string', 'max:64'],
            'os_info' => ['nullable', 'string'],
            'app_version' => ['nullable', 'string', 'max:20'],
        ]);

        $device = DesktopDevice::where('pairing_code', strtoupper(trim($validated['pairing_code'])))
            ->where('pairing_code_expires_at', '>', now())
            ->first();

        if (!$device) {
            return response()->json([
                'message' => 'Invalid or expired pairing code. Please generate a new code from the dashboard.',
            ], 422);
        }

        // Generate persistent secret API token for this Windows device
        $rawToken = 'dtk_' . Str::random(48);
        $tokenHash = hash('sha256', $rawToken);

        $device->update([
            'device_name' => $validated['device_name'],
            'device_uuid' => $validated['device_uuid'],
            'auth_token_hash' => $tokenHash,
            'os_info' => $validated['os_info'] ?? 'Windows (x64)',
            'app_version' => $validated['app_version'] ?? '1.0.0',
            'pairing_code' => null, // Invalidate pairing code immediately after single use
            'pairing_code_expires_at' => null,
            'last_heartbeat_at' => now(),
            'status' => 'online',
        ]);

        $device->load('branch.shop');

        AuditLog::create([
            'shop_id' => $device->branch->shop_id,
            'action' => 'device_paired',
            'entity_type' => 'desktop_device',
            'entity_id' => $device->id,
            'ip_address' => $request->ip(),
            'details' => [
                'device_name' => $device->device_name,
                'device_uuid' => $device->device_uuid,
                'branch_id' => $device->branch_id,
            ],
        ]);

        return response()->json([
            'message' => 'Device paired successfully with ' . $device->branch->name,
            'device_token' => $rawToken,
            'device' => [
                'id' => $device->id,
                'name' => $device->device_name,
                'uuid' => $device->device_uuid,
                'status' => $device->status,
            ],
            'branch' => [
                'id' => $device->branch->id,
                'name' => $device->branch->name,
                'shop_name' => $device->branch->shop->name,
            ],
        ]);
    }

    /**
     * Device Heartbeat & Hardware Telemetry
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $token = $request->header('X-Device-Token');
        if (!$token) {
            return response()->json(['message' => 'Missing device token'], 401);
        }

        $tokenHash = hash('sha256', $token);
        $device = DesktopDevice::where('auth_token_hash', $tokenHash)->first();

        if (!$device) {
            return response()->json(['message' => 'Unauthorized device'], 401);
        }

        $device->update([
            'last_heartbeat_at' => now(),
            'status' => $request->input('status', 'online'),
        ]);

        return response()->json([
            'status' => 'ok',
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Get printers configured for the paired branch
     */
    public function printers(Request $request): JsonResponse
    {
        $token = $request->header('X-Device-Token');
        if (!$token) {
            return response()->json(['message' => 'Missing device token'], 401);
        }

        $tokenHash = hash('sha256', $token);
        $device = DesktopDevice::where('auth_token_hash', $tokenHash)->first();

        if (!$device) {
            return response()->json(['message' => 'Unauthorized device'], 401);
        }

        $printers = Printer::where('branch_id', $device->branch_id)
            ->where('is_active', true)
            ->get();

        return response()->json(['printers' => $printers]);
    }
}
