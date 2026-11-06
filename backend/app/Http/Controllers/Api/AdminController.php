<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DesktopDevice;
use App\Models\Order;
use App\Models\Plan;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\Shop;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    /**
     * Platform-wide super admin analytics metrics.
     */
    public function metrics(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Forbidden: Super admin access required.'], 403);
        }

        $grossVolume = (float) Order::whereIn('status', ['PAID', 'PRINT_QUEUED', 'DOWNLOADING', 'PRINTING', 'COMPLETED'])
            ->sum('total_amount');

        $activeSubscriptions = Subscription::where('status', 'active')->count();

        $plansBreakdown = Plan::withCount(['subscriptions' => function ($q) {
            $q->where('status', 'active');
        }])->get()->map(fn($p) => [
            'name' => $p->name,
            'slug' => $p->slug,
            'monthly_price' => $p->monthly_price,
            'active_subscribers' => $p->subscriptions_count,
        ]);

        return response()->json([
            'metrics' => [
                'total_shops' => Shop::count(),
                'total_branches' => Branch::count(),
                'total_printers' => Printer::count(),
                'total_desktop_devices' => DesktopDevice::count(),
                'online_desktop_devices' => DesktopDevice::where('status', 'online')->count(),
                'total_orders' => Order::count(),
                'gross_platform_volume' => round($grossVolume, 2),
                'total_prints_completed' => PrintJob::where('status', 'COMPLETED')->count(),
                'active_subscriptions_count' => $activeSubscriptions,
                'plans_breakdown' => $plansBreakdown,
            ],
        ]);
    }

    /**
     * List all shops in the platform.
     */
    public function shops(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Forbidden: Super admin access required.'], 403);
        }

        $shops = Shop::with(['owner:id,name,email', 'branches.printers', 'activeSubscription.plan'])
            ->withCount(['branches'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['shops' => $shops]);
    }

    /**
     * Update shop status (activate or suspend).
     */
    public function updateShopStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Forbidden: Super admin access required.'], 403);
        }

        $validated = $request->validate([
            'status' => ['required', 'in:active,suspended'],
        ]);

        $shop = Shop::findOrFail($id);
        $shop->update(['status' => $validated['status']]);

        AuditLog::create([
            'user_id' => $user->id,
            'shop_id' => $shop->id,
            'action' => 'shop_status_changed_by_admin',
            'entity_type' => 'shop',
            'entity_id' => $shop->id,
            'ip_address' => $request->ip(),
            'details' => ['new_status' => $validated['status']],
        ]);

        return response()->json([
            'message' => "Shop status updated to {$validated['status']}",
            'shop' => $shop,
        ]);
    }

    /**
     * Platform-wide audit logs.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Forbidden: Super admin access required.'], 403);
        }

        $logs = AuditLog::with(['shop:id,name', 'user:id,name,email'])
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return response()->json(['audit_logs' => $logs]);
    }

    /**
     * List all SaaS plans.
     */
    public function plans(Request $request): JsonResponse
    {
        $plans = Plan::where('is_active', true)->orderBy('monthly_price', 'asc')->get();
        return response()->json(['plans' => $plans]);
    }
}
