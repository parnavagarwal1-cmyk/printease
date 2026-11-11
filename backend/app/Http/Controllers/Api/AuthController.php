<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\PricingRule;
use App\Models\QrCode;
use App\Models\Shop;
use App\Models\ShopMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Register a new Shop Owner, Shop, and Default Branch
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'phone' => ['nullable', 'string', 'max:20'],
            'shop_name' => ['required', 'string', 'max:255'],
            'branch_name' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
        ]);

        $user = DB::transaction(function () use ($validated, $request) {
            // 1. Create User
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'phone' => $validated['phone'] ?? null,
                'role' => 'shop_owner',
                'is_active' => true,
            ]);

            // 2. Create Shop
            $slugBase = Str::slug($validated['shop_name']);
            $slug = $slugBase;
            $counter = 1;
            while (Shop::where('slug', $slug)->exists()) {
                $slug = "{$slugBase}-{$counter}";
                $counter++;
            }

            $shop = Shop::create([
                'name' => $validated['shop_name'],
                'slug' => $slug,
                'contact_email' => $validated['email'],
                'contact_phone' => $validated['phone'] ?? null,
                'status' => 'active',
                'owner_id' => $user->id,
            ]);

            // 3. Create Shop Member
            ShopMember::create([
                'shop_id' => $shop->id,
                'user_id' => $user->id,
                'role' => 'shop_owner',
            ]);

            // 4. Create Default Branch
            $branch = Branch::create([
                'shop_id' => $shop->id,
                'name' => $validated['branch_name'] ?? 'Main Branch',
                'code' => 'MAIN',
                'city' => $validated['city'] ?? null,
                'is_active' => true,
            ]);

            // 5. Default Pricing Rules for A4 and A3
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

            PricingRule::create([
                'branch_id' => $branch->id,
                'paper_size' => 'A3',
                'bw_single_price' => 5.00,
                'bw_duplex_price' => 8.00,
                'color_single_price' => 25.00,
                'color_duplex_price' => 45.00,
                'duplex_pricing_mode' => 'per_side',
                'min_order_amount' => 10.00,
                'tax_rate_percent' => 0.00,
                'is_active' => true,
            ]);

            // 6. Generate Default Branch QR Token
            QrCode::create([
                'branch_id' => $branch->id,
                'token' => QrCode::generateToken(),
                'label' => 'Main Counter QR',
                'is_active' => true,
            ]);

            // 7. Audit Log
            AuditLog::create([
                'user_id' => $user->id,
                'shop_id' => $shop->id,
                'action' => 'user_registered',
                'entity_type' => 'user',
                'entity_id' => $user->id,
                'ip_address' => $request->ip(),
                'details' => ['email' => $user->email, 'shop' => $shop->name],
            ]);

            return $user;
        });

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'message' => 'Registration successful',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
            'shop' => $user->ownedShops()->first(),
        ], 201);
    }

    /**
     * Authenticate User and issue Sanctum token
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials do not match our records.'],
            ]);
        }

        if (!$user->is_active) {
            return response()->json([
                'message' => 'Your account has been deactivated. Please contact support.',
            ], 403);
        }

        // Revoke old tokens if single session policy or keep multiple
        $token = $user->createToken('auth-token')->plainTextToken;

        $user->load(['ownedShops.branches', 'memberships.shop']);

        return response()->json([
            'message' => 'Login successful',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
            'shops' => $user->isSuperAdmin() ? Shop::with('branches')->get() : $user->ownedShops,
        ]);
    }

    /**
     * Authenticate or register User via Google OAuth ID token
     */
    public function handleGoogleAuth(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'credential' => ['required', 'string'],
        ]);

        // 1. Verify token with Google's official tokeninfo API
        try {
            $googleResponse = Http::timeout(8)->get('https://oauth2.googleapis.com/tokeninfo', [
                'id_token' => $validated['credential'],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Unable to connect to Google authentication service: ' . $e->getMessage(),
            ], 502);
        }

        if (!$googleResponse->successful()) {
            return response()->json([
                'message' => 'Invalid or expired Google authentication credential.',
            ], 401);
        }

        $payload = $googleResponse->json();
        $googleId = $payload['sub'] ?? null;
        $email = strtolower(trim($payload['email'] ?? ''));
        $emailVerified = $payload['email_verified'] ?? false;
        $name = $payload['name'] ?? ($payload['given_name'] ?? 'Google User');
        $avatarUrl = $payload['picture'] ?? null;

        if (!$email || (!$emailVerified && $emailVerified !== 'true' && $emailVerified !== true)) {
            return response()->json([
                'message' => 'Your Google email address must be verified to sign in.',
            ], 403);
        }

        // 2. Find existing user by google_id or email
        $user = User::where('google_id', $googleId)
            ->orWhere('email', $email)
            ->first();

        if ($user) {
            if (!$user->is_active) {
                return response()->json([
                    'message' => 'Your account has been deactivated. Please contact support.',
                ], 403);
            }

            // Sync latest Google ID and Avatar
            $user->update([
                'google_id' => $googleId,
                'avatar_url' => $avatarUrl ?? $user->avatar_url,
                'name' => $user->name ?: $name,
            ]);
        } else {
            // 3. New User Registration with dedicated shop & branch
            $user = DB::transaction(function () use ($name, $email, $googleId, $avatarUrl, $request) {
                $newUser = User::create([
                    'name' => $name,
                    'email' => $email,
                    'google_id' => $googleId,
                    'avatar_url' => $avatarUrl,
                    'password' => Hash::make(Str::random(32)),
                    'role' => 'shop_owner',
                    'is_active' => true,
                ]);

                // Create Default Shop
                $shopName = $name . "'s Print Hub";
                $slugBase = Str::slug($shopName);
                $slug = $slugBase;
                $counter = 1;
                while (Shop::where('slug', $slug)->exists()) {
                    $slug = "{$slugBase}-{$counter}";
                    $counter++;
                }

                $shop = Shop::create([
                    'name' => $shopName,
                    'slug' => $slug,
                    'contact_email' => $email,
                    'status' => 'active',
                    'owner_id' => $newUser->id,
                ]);

                ShopMember::create([
                    'shop_id' => $shop->id,
                    'user_id' => $newUser->id,
                    'role' => 'shop_owner',
                ]);

                $branch = Branch::create([
                    'shop_id' => $shop->id,
                    'name' => 'Main Counter',
                    'code' => 'MAIN',
                    'is_active' => true,
                ]);

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

                PricingRule::create([
                    'branch_id' => $branch->id,
                    'paper_size' => 'A3',
                    'bw_single_price' => 5.00,
                    'bw_duplex_price' => 8.00,
                    'color_single_price' => 25.00,
                    'color_duplex_price' => 45.00,
                    'duplex_pricing_mode' => 'per_side',
                    'min_order_amount' => 10.00,
                    'tax_rate_percent' => 0.00,
                    'is_active' => true,
                ]);

                QrCode::create([
                    'branch_id' => $branch->id,
                    'token' => QrCode::generateToken(),
                    'label' => 'Main Counter QR',
                    'is_active' => true,
                ]);

                AuditLog::create([
                    'user_id' => $newUser->id,
                    'shop_id' => $shop->id,
                    'action' => 'user_registered_via_google',
                    'entity_type' => 'user',
                    'entity_id' => $newUser->id,
                    'ip_address' => $request->ip(),
                    'details' => ['email' => $email, 'google_id' => $googleId],
                ]);

                return $newUser;
            });
        }

        $token = $user->createToken('auth-token')->plainTextToken;
        $user->load(['ownedShops.branches', 'memberships.shop']);

        return response()->json([
            'message' => 'Google authentication successful',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'avatar_url' => $user->avatar_url,
            ],
            'shops' => $user->isSuperAdmin() ? Shop::with('branches')->get() : $user->ownedShops,
        ]);
    }

    /**
     * Get Current Authenticated User & Tenant Context
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->load(['ownedShops.branches.printers', 'memberships.shop']);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'phone' => $user->phone,
            ],
            'shops' => $user->isSuperAdmin() ? Shop::with('branches')->get() : $user->ownedShops,
        ]);
    }

    /**
     * Logout and revoke active token
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully',
        ]);
    }
}
