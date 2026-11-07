<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\DesktopDeviceController;
use App\Http\Controllers\Api\DesktopJobController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PublicOrderController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\SoundboxWebhookController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| PrintEase SaaS API Routes
|--------------------------------------------------------------------------
*/

// --- Public Health Check ---
Route::get('/health', function () {
    $dbOk = false;
    $dbError = null;
    $dbVersion = null;

    try {
        $pdo = DB::connection()->getPdo();
        $dbOk = true;
        $dbVersion = DB::select('SELECT VERSION() as version')[0]->version ?? 'unknown';
    } catch (\Throwable $e) {
        $dbError = $e->getMessage();
    }

    $storageOk = is_writable(storage_path('framework/cache'));
    $allHealthy = $dbOk && $storageOk;

    return response()->json([
        'status' => $allHealthy ? 'healthy' : 'degraded',
        'app' => [
            'name' => config('app.name', 'PrintEase'),
            'env' => config('app.env'),
            'version' => '1.0.1-safe-pair',
            'laravel' => app()->version(),
            'php' => PHP_VERSION,
        ],
        'services' => [
            'database' => [
                'status' => $dbOk ? 'connected' : 'error',
                'driver' => config('database.default'),
                'version' => $dbVersion,
                'error' => $dbError,
            ],
            'storage' => [
                'status' => $storageOk ? 'writable' : 'readonly',
                'path' => storage_path('app/private'),
            ],
            'queue' => [
                'driver' => config('queue.default'),
            ],
        ],
        'timestamp' => now()->toIso8601String(),
    ], $allHealthy ? 200 : 503);
});

// --- Public Auth Endpoints ---
Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// --- Public Desktop Device Endpoints ---
Route::prefix('desktop')->group(function () {
    Route::post('/pair', [DesktopDeviceController::class, 'pair']);
    Route::post('/heartbeat', [DesktopDeviceController::class, 'heartbeat']);
    Route::get('/printers', [DesktopDeviceController::class, 'printers']);

    // Print Jobs Polling, Claiming, Streaming, and Telemetry (Phase 5)
    Route::get('/jobs/poll', [DesktopJobController::class, 'pollJobs']);
    Route::post('/jobs/{id}/claim', [DesktopJobController::class, 'claimJob']);
    Route::get('/jobs/{id}/download', [DesktopJobController::class, 'downloadFile']);
    Route::post('/jobs/{id}/status', [DesktopJobController::class, 'updateStatus']);
});

// --- Public Customer QR & Order Endpoints ---
Route::prefix('public')->group(function () {
    Route::get('/qr/{token}', [PublicOrderController::class, 'resolveQr']);
    Route::post('/qr/{token}/estimate', [PublicOrderController::class, 'estimate']);
    Route::post('/qr/{token}/upload', [PublicOrderController::class, 'uploadFile']);
    Route::post('/qr/{token}/orders', [PublicOrderController::class, 'createOrder']);
    Route::get('/orders/{orderNumber}', [PublicOrderController::class, 'getOrderStatus']);

    // Payment Endpoints
    Route::post('/orders/{orderNumber}/pay', [PaymentController::class, 'initiatePayment']);
    Route::post('/orders/{orderNumber}/verify-payment', [PaymentController::class, 'verifyPayment']);
    Route::get('/orders/{orderNumber}/upi-qr', [SoundboxWebhookController::class, 'getUpiQr']);
});

// --- Public Webhooks (Razorpay & Soundboxes) ---
Route::post('/webhooks/razorpay', [PaymentController::class, 'handleWebhook']);
Route::post('/webhooks/paytm', [SoundboxWebhookController::class, 'handlePaytmWebhook']);
Route::post('/webhooks/phonepe', [SoundboxWebhookController::class, 'handlePhonePeWebhook']);
Route::post('/webhooks/soundbox/simulate', [SoundboxWebhookController::class, 'simulateWebhook']);

// --- Authenticated Tenant Endpoints (Sanctum) ---
Route::middleware('auth:sanctum')->group(function () {
    // Current User
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // Shops Management
    Route::get('/shops', [ShopController::class, 'index']);
    Route::post('/shops', [ShopController::class, 'store']);
    Route::get('/shops/{id}', [ShopController::class, 'show']);
    Route::put('/shops/{id}', [ShopController::class, 'update']);
    Route::post('/shops/{id}/subscribe', [ShopController::class, 'subscribe']);

    // Branches Management
    Route::get('/branches', [BranchController::class, 'index']);
    Route::post('/branches', [BranchController::class, 'store']);
    Route::get('/branches/{id}', [BranchController::class, 'show']);
    Route::put('/branches/{id}', [BranchController::class, 'update']);
    Route::post('/branches/{id}/pairing-code', [BranchController::class, 'generatePairingCode']);
    Route::delete('/branches/{id}/devices/{deviceId}', [BranchController::class, 'deleteDevice']);
    Route::post('/branches/{id}/devices/cleanup', [BranchController::class, 'cleanupDevices']);
    Route::get('/branches/{id}/analytics', [BranchController::class, 'analytics']);
    Route::get('/branches/{id}/orders', [BranchController::class, 'orders']);
    Route::put('/branches/{id}/pricing-rules', [BranchController::class, 'updatePricingRules']);
    Route::post('/branches/{id}/printers', [BranchController::class, 'addPrinter']);
    Route::get('/branches/{id}/qr-poster', [BranchController::class, 'qrPoster']);

    // Super Admin Control Plane
    Route::prefix('admin')->group(function () {
        Route::get('/metrics', [AdminController::class, 'metrics']);
        Route::get('/shops', [AdminController::class, 'shops']);
        Route::put('/shops/{id}/status', [AdminController::class, 'updateShopStatus']);
        Route::get('/audit-logs', [AdminController::class, 'auditLogs']);
        Route::get('/plans', [AdminController::class, 'plans']);
    });
});
