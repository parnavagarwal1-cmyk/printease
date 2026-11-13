<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DesktopDevice;
use App\Models\Order;
use App\Models\Plan;
use App\Models\PricingRule;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\QrCode;
use App\Models\Shop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BranchController extends Controller
{
    /**
     * List branches (Tenant Scoped)
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $shopId = $request->query('shop_id');

        if ($shopId) {
            if (!$user->canAccessShop((int) $shopId)) {
                return response()->json(['message' => 'Forbidden: You do not have access to this shop.'], 403);
            }
            $branches = Branch::where('shop_id', $shopId)->with(['printers', 'activeQrCode', 'desktopDevices'])->get();
        } else {
            if ($user->isSuperAdmin()) {
                $branches = Branch::with(['shop:id,name', 'printers'])->get();
            } else {
                $shopIds = $user->ownedShops()->pluck('id')
                    ->merge($user->memberships()->pluck('shop_id'))
                    ->unique();
                $branches = Branch::whereIn('shop_id', $shopIds)->with(['printers', 'activeQrCode', 'desktopDevices'])->get();
            }
        }

        return response()->json(['branches' => $branches]);
    }

    /**
     * Create new branch (Tenant Scoped)
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'shop_id' => ['required', 'integer', 'exists:shops,id'],
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'pincode' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
            'merchant_vpa' => ['nullable', 'string', 'max:100'],
            'merchant_name' => ['nullable', 'string', 'max:150'],
            'soundbox_provider' => ['nullable', 'string', 'max:30'],
            'razorpay_enabled' => ['nullable', 'boolean'],
            'razorpay_key_id' => ['nullable', 'string', 'max:100'],
            'razorpay_key_secret' => ['nullable', 'string', 'max:150'],
        ]);

        if (!$user->canAccessShop((int) $validated['shop_id'])) {
            return response()->json(['message' => 'Forbidden: You do not own or manage this shop.'], 403);
        }

        $shop = Shop::with(['branches', 'activeSubscription.plan'])->findOrFail((int) $validated['shop_id']);
        $plan = $shop->activeSubscription?->plan ?? Plan::where('slug', 'starter')->first();
        $maxBranches = $plan ? $plan->max_branches : 1;

        if ($shop->branches()->count() >= $maxBranches) {
            return response()->json([
                'message' => "Branch limit of {$maxBranches} reached for your {$plan?->name} plan. Please upgrade your subscription plan to add more branches.",
                'current_branches' => $shop->branches()->count(),
                'max_allowed' => $maxBranches,
            ], 403);
        }

        $branch = Branch::create($validated);

        // Create default pricing rules for new branch
        PricingRule::create([
            'branch_id' => $branch->id,
            'paper_size' => 'A4',
            'bw_single_price' => 2.00,
            'bw_duplex_price' => 3.00,
            'color_single_price' => 10.00,
            'color_duplex_price' => 18.00,
            'duplex_pricing_mode' => 'per_side',
            'min_order_amount' => 5.00,
            'tax_rate_percent' => 0.00,
            'is_active' => true,
        ]);

        // Generate unguessable QR Token
        $qr = QrCode::create([
            'branch_id' => $branch->id,
            'token' => QrCode::generateToken(),
            'label' => "{$branch->name} Main QR",
            'is_active' => true,
        ]);

        AuditLog::create([
            'user_id' => $user->id,
            'shop_id' => $branch->shop_id,
            'action' => 'branch_created',
            'entity_type' => 'branch',
            'entity_id' => $branch->id,
            'ip_address' => $request->ip(),
            'details' => ['name' => $branch->name],
        ]);

        return response()->json([
            'message' => 'Branch created successfully',
            'branch' => $branch->load(['printers', 'activeQrCode', 'pricingRules']),
        ], 201);
    }

    /**
     * Get branch details (Tenant Scoped)
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $branch = Branch::with(['printers', 'desktopDevices', 'qrCodes', 'pricingRules'])->findOrFail($id);

        $threshold = now()->subMinutes(2);
        $branch->desktopDevices->transform(function ($dev) use ($threshold) {
            if ($dev->status === 'online') {
                $lastSeen = $dev->last_heartbeat_at ?? $dev->created_at;
                if (!$lastSeen || $lastSeen->lt($threshold)) {
                    $dev->status = 'offline';
                }
            }
            return $dev;
        });

        return response()->json(['branch' => $branch]);
    }

    /**
     * Update branch (Tenant Scoped)
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $branch = Branch::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'pincode' => ['nullable', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
            'merchant_vpa' => ['nullable', 'string', 'max:100'],
            'merchant_name' => ['nullable', 'string', 'max:150'],
            'soundbox_provider' => ['nullable', 'string', 'max:30'],
            'razorpay_enabled' => ['nullable', 'boolean'],
            'razorpay_key_id' => ['nullable', 'string', 'max:100'],
            'razorpay_key_secret' => ['nullable', 'string', 'max:150'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $branch->update($validated);

        return response()->json(['message' => 'Branch updated successfully', 'branch' => $branch]);
    }

    /**
     * Generate secure Pairing Code for Windows Desktop Agent
     */
    public function generatePairingCode(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $branch = Branch::findOrFail($id);

        // Generate formatted pairing code: e.g. PRNT-XXXX-XX
        $code = 'PRNT-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(2));

        $device = DesktopDevice::create([
            'branch_id' => $branch->id,
            'device_name' => $request->input('device_name', 'Pending Windows Agent'),
            'device_uuid' => 'pending-' . Str::uuid(),
            'pairing_code' => $code,
            'pairing_code_expires_at' => now()->addMinutes(15),
            'status' => 'standby',
        ]);

        AuditLog::create([
            'user_id' => $user->id,
            'shop_id' => $branch->shop_id,
            'action' => 'pairing_code_generated',
            'entity_type' => 'desktop_device',
            'entity_id' => $device->id,
            'ip_address' => $request->ip(),
            'details' => ['pairing_code' => $code, 'branch_id' => $branch->id],
        ]);

        return response()->json([
            'message' => 'Pairing code generated successfully',
            'pairing_code' => $code,
            'expires_at' => $device->pairing_code_expires_at->toIso8601String(),
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'shop_name' => $branch->shop->name,
            ],
        ]);
    }

    /**
     * Get branch analytics for shop dashboard.
     */
    public function analytics(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $branch = Branch::with(['printers', 'desktopDevices'])->findOrFail($id);
        $today = now()->startOfDay();

        $todayOrders = Order::where('branch_id', $branch->id)
            ->where('created_at', '>=', $today)
            ->get();

        $revenueToday = $todayOrders
            ->whereIn('status', ['PAID', 'PRINT_QUEUED', 'DOWNLOADING', 'PRINTING', 'COMPLETED'])
            ->sum('total_amount');

        $printJobs = PrintJob::whereHas('order', fn($q) => $q->where('branch_id', $branch->id))->get();

        $completedToday = $printJobs->where('status', 'COMPLETED')
            ->where('completed_at', '>=', $today)
            ->count();

        $pendingJobs = $printJobs->whereIn('status', ['PRINT_QUEUED', 'DOWNLOADING', 'PRINTING'])->count();
        $failedJobs = $printJobs->where('status', 'PRINT_FAILED')->count();

        $activePrinters = $branch->printers->where('is_active', true)->count();
        $onlineThreshold = now()->subMinutes(2);
        $onlineDevices = $branch->desktopDevices->filter(function ($dev) use ($onlineThreshold) {
            if ($dev->status !== 'online') {
                return false;
            }
            $lastSeen = $dev->last_heartbeat_at ?? $dev->created_at;
            return $lastSeen && $lastSeen->gte($onlineThreshold);
        })->count();

        return response()->json([
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
            ],
            'analytics' => [
                'revenue_today' => round((float) $revenueToday, 2),
                'orders_today_count' => $todayOrders->count(),
                'completed_prints_today' => $completedToday,
                'pending_jobs_count' => $pendingJobs,
                'failed_jobs_count' => $failedJobs,
                'active_printers_count' => $activePrinters,
                'online_devices_count' => $onlineDevices,
            ],
        ]);
    }

    /**
     * Get branch orders list.
     */
    public function orders(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $status = $request->query('status');
        $query = Order::where('branch_id', $id)
            ->with(['files', 'items', 'printJobs'])
            ->orderBy('created_at', 'desc');

        if ($status) {
            $query->where('status', $status);
        }

        $orders = $query->limit(50)->get();

        return response()->json([
            'orders' => $orders,
            'count' => $orders->count(),
        ]);
    }

    /**
     * Update branch pricing rules.
     */
    public function updatePricingRules(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $branch = Branch::findOrFail($id);

        $validated = $request->validate([
            'default_paper_size' => ['nullable', 'string', 'max:20'],
            'rules' => ['required', 'array', 'min:1'],
            'rules.*.paper_size' => ['required', 'string', 'max:20'],
            'rules.*.bw_single_price' => ['required', 'numeric', 'min:0'],
            'rules.*.bw_duplex_price' => ['required', 'numeric', 'min:0'],
            'rules.*.color_single_price' => ['required', 'numeric', 'min:0'],
            'rules.*.color_duplex_price' => ['required', 'numeric', 'min:0'],
            'rules.*.duplex_pricing_mode' => ['required', 'in:per_side,per_sheet'],
            'rules.*.min_order_amount' => ['required', 'numeric', 'min:0'],
            'rules.*.tax_rate_percent' => ['required', 'numeric', 'min:0'],
            'rules.*.is_active' => ['sometimes', 'boolean'],
        ]);

        if (!empty($validated['default_paper_size'])) {
            try {
                $branch->update(['default_paper_size' => strtoupper($validated['default_paper_size'])]);
            } catch (\Illuminate\Database\QueryException $e) {
                if (str_contains($e->getMessage(), 'Unknown column') || str_contains($e->getMessage(), 'default_paper_size')) {
                    \Illuminate\Support\Facades\Schema::table('branches', function (\Illuminate\Database\Schema\Blueprint $table) {
                        $table->string('default_paper_size', 20)->default('A4')->after('soundbox_provider');
                    });
                    $branch->update(['default_paper_size' => strtoupper($validated['default_paper_size'])]);
                } else {
                    throw $e;
                }
            }
        }

        $updatedRules = [];
        foreach ($validated['rules'] as $ruleData) {
            $rule = PricingRule::updateOrCreate(
                [
                    'branch_id' => $branch->id,
                    'paper_size' => strtoupper($ruleData['paper_size']),
                ],
                [
                    'bw_single_price' => $ruleData['bw_single_price'],
                    'bw_duplex_price' => $ruleData['bw_duplex_price'],
                    'color_single_price' => $ruleData['color_single_price'],
                    'color_duplex_price' => $ruleData['color_duplex_price'],
                    'duplex_pricing_mode' => $ruleData['duplex_pricing_mode'],
                    'min_order_amount' => $ruleData['min_order_amount'],
                    'tax_rate_percent' => $ruleData['tax_rate_percent'],
                    'is_active' => array_key_exists('is_active', $ruleData) ? (bool) $ruleData['is_active'] : true,
                ]
            );
            $updatedRules[] = $rule;
        }

        AuditLog::create([
            'user_id' => $user->id,
            'shop_id' => $branch->shop_id,
            'action' => 'pricing_rules_updated',
            'entity_type' => 'branch',
            'entity_id' => $branch->id,
            'ip_address' => $request->ip(),
            'details' => ['rules_count' => count($updatedRules)],
        ]);

        return response()->json([
            'message' => 'Pricing rules updated successfully',
            'pricing_rules' => $updatedRules,
            'default_paper_size' => $branch->fresh()->default_paper_size ?? 'A4',
        ]);
    }

    /**
     * Add new printer to branch.
     */
    public function addPrinter(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $branch = Branch::with(['printers', 'shop.activeSubscription.plan'])->findOrFail($id);
        $plan = $branch->shop->activeSubscription?->plan ?? Plan::where('slug', 'starter')->first();
        $maxPrinters = $plan ? $plan->max_printers_per_branch : 2;

        if ($branch->printers()->count() >= $maxPrinters) {
            return response()->json([
                'message' => "Printer limit of {$maxPrinters} reached for this branch on the {$plan?->name} plan. Please upgrade your subscription plan to add more printers.",
                'current_printers' => $branch->printers()->count(),
                'max_allowed' => $maxPrinters,
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'model' => ['nullable', 'string', 'max:255'],
            'connection_type' => ['required', 'in:usb,network,bluetooth,cloud'],
            'supports_color' => ['required', 'boolean'],
            'supports_duplex' => ['required', 'boolean'],
            'supported_paper_sizes' => ['required', 'array'],
        ]);

        $printer = Printer::create([
            'branch_id' => $branch->id,
            'name' => $validated['name'],
            'system_printer_name' => $validated['name'],
            'model' => $validated['model'] ?? 'Standard Printer',
            'capabilities' => [
                'color' => (bool) $validated['supports_color'],
                'duplex' => (bool) $validated['supports_duplex'],
                'paper_sizes' => $validated['supported_paper_sizes'],
            ],
            'status' => 'idle',
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Printer added successfully',
            'printer' => $printer,
        ], 201);
    }

    /**
     * Generate printable QR Code poster data.
     */
    public function qrPoster(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $branch = Branch::with(['shop', 'activeQrCode', 'pricingRules'])->findOrFail($id);
        $qrCode = $branch->activeQrCode;

        if (!$qrCode) {
            $qrCode = QrCode::create([
                'branch_id' => $branch->id,
                'token' => QrCode::generateToken(),
                'label' => 'Default Counter QR',
                'is_active' => true,
            ]);
        }

        $appUrl = config('app.url') ?: url('/');
        $scanUrl = rtrim($appUrl, '/') . "/?qr={$qrCode->token}";
        $qrImageUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=15&data=" . urlencode($scanUrl);

        return response()->json([
            'poster' => [
                'shop_name' => $branch->shop->name,
                'shop_logo_url' => $branch->shop->logo_url,
                'branch_name' => $branch->name,
                'branch_address' => $branch->address,
                'branch_phone' => $branch->phone,
                'qr_token' => $qrCode->token,
                'scan_url' => $scanUrl,
                'qr_image_url' => $qrImageUrl,
                'tagline' => 'Self-Service Contactless Printing',
                'steps' => [
                    ['step' => 1, 'title' => 'Scan QR Code', 'description' => 'Open camera on your smartphone'],
                    ['step' => 2, 'title' => 'Upload PDF', 'description' => 'Select color, sides, and copies'],
                    ['step' => 3, 'title' => 'Pay & Print', 'description' => 'Instant UPI / Card release to counter'],
                ],
                'pricing_summary' => $branch->pricingRules->map(fn($r) => [
                    'paper_size' => $r->paper_size,
                    'bw_starting' => $r->bw_single_price,
                    'color_starting' => $r->color_single_price,
                ]),
            ],
        ]);
    }

    /**
     * Delete or unpair a desktop device from a branch.
     */
    public function deleteDevice(Request $request, int $id, int $deviceId): JsonResponse
    {
        $user = $request->user();
        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $branch = Branch::findOrFail($id);
        $device = DesktopDevice::where('branch_id', $branch->id)->where('id', $deviceId)->firstOrFail();

        // Unclaim any queued or downloading jobs from this device
        PrintJob::where('claimed_by_device_id', $device->id)
            ->whereIn('status', ['PRINT_QUEUED', 'DOWNLOADING', 'PRINTING'])
            ->update([
                'claimed_by_device_id' => null,
                'job_lease_token' => null,
                'status' => 'PRINT_QUEUED',
            ]);

        $device->delete();

        return response()->json([
            'message' => 'Device removed successfully.',
            'device_id' => $deviceId,
        ]);
    }

    /**
     * Clean up all inactive and standby desktop devices for a branch.
     */
    public function cleanupDevices(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->canAccessBranch($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this branch.'], 403);
        }

        $branch = Branch::findOrFail($id);
        $threshold = now()->subMinutes(2);

        $staleDevices = DesktopDevice::where('branch_id', $branch->id)
            ->where(function ($q) use ($threshold) {
                $q->where('status', '!=', 'online')
                  ->orWhere(function ($q2) use ($threshold) {
                      $q2->where('status', 'online')
                         ->where(function ($q3) use ($threshold) {
                             $q3->where('last_heartbeat_at', '<', $threshold)
                                ->orWhere(function ($q4) use ($threshold) {
                                    $q4->whereNull('last_heartbeat_at')
                                       ->where('created_at', '<', $threshold);
                                });
                         });
                  });
            })
            ->get();

        $count = $staleDevices->count();
        foreach ($staleDevices as $dev) {
            PrintJob::where('claimed_by_device_id', $dev->id)->update(['claimed_by_device_id' => null]);
            $dev->delete();
        }

        return response()->json([
            'message' => "Cleaned up {$count} inactive desktop device(s).",
            'deleted_count' => $count,
        ]);
    }
}
