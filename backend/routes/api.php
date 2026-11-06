<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\DesktopDeviceController;
use App\Http\Controllers\Api\ShopController;
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
            'version' => '1.0.0',
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
});

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

    // Branches Management
    Route::get('/branches', [BranchController::class, 'index']);
    Route::post('/branches', [BranchController::class, 'store']);
    Route::get('/branches/{id}', [BranchController::class, 'show']);
    Route::put('/branches/{id}', [BranchController::class, 'update']);
    Route::post('/branches/{id}/pairing-code', [BranchController::class, 'generatePairingCode']);
});
