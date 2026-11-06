<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Shop;
use App\Models\ShopMember;
use App\Models\User;
use Tests\TestCase;

class TenantIsolationTest extends TestCase
{
    public function test_shop_owner_a_cannot_view_or_modify_shop_owner_b_data(): void
    {
        // Tenant A
        $userA = User::factory()->create(['role' => 'shop_owner']);
        $shopA = Shop::create([
            'name' => 'Shop Alpha',
            'slug' => 'shop-alpha',
            'contact_email' => 'alpha@test.com',
            'owner_id' => $userA->id,
        ]);
        $branchA = Branch::create([
            'shop_id' => $shopA->id,
            'name' => 'Alpha Branch',
        ]);

        // Tenant B
        $userB = User::factory()->create(['role' => 'shop_owner']);
        $shopB = Shop::create([
            'name' => 'Shop Beta',
            'slug' => 'shop-beta',
            'contact_email' => 'beta@test.com',
            'owner_id' => $userB->id,
        ]);
        $branchB = Branch::create([
            'shop_id' => $shopB->id,
            'name' => 'Beta Branch',
        ]);

        $tokenA = $userA->createToken('token-a')->plainTextToken;

        // 1. User A tries to view Shop B -> 403 Forbidden
        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $tokenA,
        ])->getJson("/api/shops/{$shopB->id}");

        $response->assertStatus(403);

        // 2. User A tries to update Shop B -> 403 Forbidden
        $responseUpdate = $this->withHeaders([
            'Authorization' => 'Bearer ' . $tokenA,
        ])->putJson("/api/shops/{$shopB->id}", [
            'name' => 'Malicious Rename',
        ]);

        $responseUpdate->assertStatus(403);
        $this->assertDatabaseHas('shops', ['id' => $shopB->id, 'name' => 'Shop Beta']);

        // 3. User A tries to view Branch B -> 403 Forbidden
        $responseBranch = $this->withHeaders([
            'Authorization' => 'Bearer ' . $tokenA,
        ])->getJson("/api/branches/{$branchB->id}");

        $responseBranch->assertStatus(403);

        // 4. User A tries to create branch under Shop B -> 403 Forbidden
        $responseCreateBranch = $this->withHeaders([
            'Authorization' => 'Bearer ' . $tokenA,
        ])->postJson('/api/branches', [
            'shop_id' => $shopB->id,
            'name' => 'Illegitimate Branch',
        ]);

        $responseCreateBranch->assertStatus(403);

        // 5. User A tries to generate pairing code for Branch B -> 403 Forbidden
        $responsePair = $this->withHeaders([
            'Authorization' => 'Bearer ' . $tokenA,
        ])->postJson("/api/branches/{$branchB->id}/pairing-code");

        $responsePair->assertStatus(403);
    }

    public function test_super_admin_can_access_any_tenant_data(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin']);
        $owner = User::factory()->create(['role' => 'shop_owner']);
        $shop = Shop::create([
            'name' => 'Omni Print',
            'slug' => 'omni-print',
            'contact_email' => 'omni@test.com',
            'owner_id' => $owner->id,
        ]);
        $branch = Branch::create([
            'shop_id' => $shop->id,
            'name' => 'Omni Branch',
        ]);

        $adminToken = $superAdmin->createToken('admin-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $adminToken,
        ])->getJson("/api/shops/{$shop->id}");

        $response->assertStatus(200)
            ->assertJsonPath('shop.name', 'Omni Print');

        $branchResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $adminToken,
        ])->getJson("/api/branches/{$branch->id}");

        $branchResponse->assertStatus(200)
            ->assertJsonPath('branch.name', 'Omni Branch');
    }
}
