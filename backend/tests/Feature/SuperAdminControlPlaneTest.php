<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Plan;
use App\Models\Printer;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SuperAdminControlPlaneTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $shopOwner;
    protected Shop $shop;
    protected Branch $branch;
    protected Plan $starterPlan;
    protected Plan $proPlan;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed Plans
        $this->starterPlan = Plan::create([
            'name' => 'Starter',
            'slug' => 'starter',
            'monthly_price' => 499.00,
            'max_branches' => 1,
            'max_printers_per_branch' => 2,
            'is_active' => true,
        ]);

        $this->proPlan = Plan::create([
            'name' => 'Pro',
            'slug' => 'pro',
            'monthly_price' => 1499.00,
            'max_branches' => 3,
            'max_printers_per_branch' => 10,
            'is_active' => true,
        ]);

        $this->superAdmin = User::factory()->create([
            'email' => 'superadmin@printease.com',
            'role' => 'super_admin',
        ]);

        $this->shopOwner = User::factory()->create([
            'email' => 'owner@starterprint.com',
            'role' => 'shop_owner',
        ]);

        $this->shop = Shop::create([
            'name' => 'Starter Print Hub',
            'slug' => 'starter-print-hub',
            'owner_id' => $this->shopOwner->id,
            'contact_email' => 'owner@starterprint.com',
            'status' => 'active',
        ]);

        // Assign Starter Plan Subscription
        Subscription::create([
            'shop_id' => $this->shop->id,
            'plan_id' => $this->starterPlan->id,
            'status' => 'active',
            'starts_at' => now(),
            'ends_at' => now()->addMonth(),
        ]);

        $this->branch = Branch::create([
            'shop_id' => $this->shop->id,
            'name' => 'Single Main Branch',
            'is_active' => true,
        ]);
    }

    public function test_super_admin_can_access_metrics(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/admin/metrics');

        $response->assertStatus(200)
            ->assertJsonPath('metrics.total_shops', 1)
            ->assertJsonPath('metrics.total_branches', 1)
            ->assertJsonStructure(['metrics' => ['gross_platform_volume', 'plans_breakdown']]);
    }

    public function test_regular_shop_owner_is_forbidden_from_admin_metrics(): void
    {
        Sanctum::actingAs($this->shopOwner);

        $response = $this->getJson('/api/admin/metrics');
        $response->assertStatus(403)
            ->assertJsonPath('message', 'Forbidden: Super admin access required.');
    }

    public function test_subscription_quota_enforces_starter_branch_limit(): void
    {
        Sanctum::actingAs($this->shopOwner);

        // Shop already has 1 branch (max allowed on Starter is 1)
        $response = $this->postJson('/api/branches', [
            'shop_id' => $this->shop->id,
            'name' => 'Forbidden Second Branch',
        ]);

        $response->assertStatus(403);
        $this->assertStringContainsString('Branch limit of 1 reached', $response->json('message'));
    }

    public function test_upgrading_plan_allows_additional_branches(): void
    {
        Sanctum::actingAs($this->shopOwner);

        // 1. Upgrade to Pro
        $upgradeResp = $this->postJson("/api/shops/{$this->shop->id}/subscribe", [
            'plan_slug' => 'pro',
        ]);
        $upgradeResp->assertStatus(200)
            ->assertJsonPath('subscription.plan.slug', 'pro');

        // 2. Now creating 2nd branch succeeds!
        $branchResp = $this->postJson('/api/branches', [
            'shop_id' => $this->shop->id,
            'name' => 'Pro Secondary Branch',
        ]);

        $branchResp->assertStatus(201)
            ->assertJsonPath('branch.name', 'Pro Secondary Branch');

        $this->assertEquals(2, $this->shop->branches()->count());
    }

    public function test_subscription_quota_enforces_printer_limit(): void
    {
        Sanctum::actingAs($this->shopOwner);

        // Add 1st printer (Allowed, max 2)
        $p1 = $this->postJson("/api/branches/{$this->branch->id}/printers", [
            'name' => 'Printer 1',
            'connection_type' => 'usb',
            'supports_color' => false,
            'supports_duplex' => true,
            'supported_paper_sizes' => ['A4'],
        ]);
        $p1->assertStatus(201);

        // Add 2nd printer (Allowed, max 2)
        $p2 = $this->postJson("/api/branches/{$this->branch->id}/printers", [
            'name' => 'Printer 2',
            'connection_type' => 'usb',
            'supports_color' => true,
            'supports_duplex' => true,
            'supported_paper_sizes' => ['A4'],
        ]);
        $p2->assertStatus(201);

        // Add 3rd printer (Rejected - limit reached on Starter)
        $p3 = $this->postJson("/api/branches/{$this->branch->id}/printers", [
            'name' => 'Printer 3',
            'connection_type' => 'usb',
            'supports_color' => false,
            'supports_duplex' => false,
            'supported_paper_sizes' => ['A4'],
        ]);
        $p3->assertStatus(403);
        $this->assertStringContainsString('Printer limit of 2 reached', $p3->json('message'));
    }

    public function test_super_admin_can_update_shop_status(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->putJson("/api/admin/shops/{$this->shop->id}/status", [
            'status' => 'suspended',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('shop.status', 'suspended');

        $this->assertDatabaseHas('shops', [
            'id' => $this->shop->id,
            'status' => 'suspended',
        ]);
    }

    public function test_super_admin_can_view_audit_trail(): void
    {
        Sanctum::actingAs($this->superAdmin);

        $response = $this->getJson('/api/admin/audit-logs');

        $response->assertStatus(200)
            ->assertJsonStructure(['audit_logs']);
    }
}
