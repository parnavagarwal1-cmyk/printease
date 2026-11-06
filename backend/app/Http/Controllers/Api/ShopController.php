<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Shop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ShopController extends Controller
{
    /**
     * List accessible shops for current user
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isSuperAdmin()) {
            $shops = Shop::with(['owner:id,name,email', 'branches'])->get();
        } else {
            $shops = Shop::where('owner_id', $user->id)
                ->orWhereHas('members', fn($q) => $q->where('user_id', $user->id))
                ->with('branches')
                ->get();
        }

        return response()->json(['shops' => $shops]);
    }

    /**
     * Create additional shop
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'contact_email' => ['required', 'string', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:20'],
            'gst_number' => ['nullable', 'string', 'max:30'],
        ]);

        $slugBase = Str::slug($validated['name']);
        $slug = $slugBase;
        $counter = 1;
        while (Shop::where('slug', $slug)->exists()) {
            $slug = "{$slugBase}-{$counter}";
            $counter++;
        }

        $shop = Shop::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'contact_email' => $validated['contact_email'],
            'contact_phone' => $validated['contact_phone'] ?? null,
            'gst_number' => $validated['gst_number'] ?? null,
            'status' => 'active',
            'owner_id' => $user->id,
        ]);

        AuditLog::create([
            'user_id' => $user->id,
            'shop_id' => $shop->id,
            'action' => 'shop_created',
            'entity_type' => 'shop',
            'entity_id' => $shop->id,
            'ip_address' => $request->ip(),
            'details' => ['name' => $shop->name],
        ]);

        return response()->json(['message' => 'Shop created successfully', 'shop' => $shop], 201);
    }

    /**
     * Get specific shop (Tenant Isolation Enforced)
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessShop($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this shop.'], 403);
        }

        $shop = Shop::with(['branches.printers', 'branches.activeQrCode', 'activeSubscription.plan'])->findOrFail($id);

        return response()->json(['shop' => $shop]);
    }

    /**
     * Update shop (Tenant Isolation Enforced)
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        if (!$user->canAccessShop($id)) {
            return response()->json(['message' => 'Forbidden: You do not have access to this shop.'], 403);
        }

        $shop = Shop::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'contact_email' => ['sometimes', 'required', 'string', 'email', 'max:255'],
            'contact_phone' => ['nullable', 'string', 'max:20'],
            'gst_number' => ['nullable', 'string', 'max:30'],
        ]);

        $shop->update($validated);

        AuditLog::create([
            'user_id' => $user->id,
            'shop_id' => $shop->id,
            'action' => 'shop_updated',
            'entity_type' => 'shop',
            'entity_id' => $shop->id,
            'ip_address' => $request->ip(),
            'details' => $validated,
        ]);

        return response()->json(['message' => 'Shop updated successfully', 'shop' => $shop]);
    }
}
