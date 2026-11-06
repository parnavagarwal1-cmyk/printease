<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DesktopDevice;
use App\Models\PricingRule;
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
        ]);

        if (!$user->canAccessShop((int) $validated['shop_id'])) {
            return response()->json(['message' => 'Forbidden: You do not own or manage this shop.'], 403);
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
}
