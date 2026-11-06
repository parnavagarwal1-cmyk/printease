<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\PricingRule;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShopOwnerDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $foreignOwner;
    protected Shop $shop;
    protected Branch $branch;
    protected Printer $printer;
    protected Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        // Legitimate shop owner
        $this->owner = User::factory()->create([
            'email' => 'owner@delhiprints.com',
            'role' => 'shop_owner',
        ]);

        $this->shop = Shop::create([
            'name' => 'Delhi Super Prints',
            'slug' => 'delhi-super-prints',
            'owner_id' => $this->owner->id,
            'contact_email' => 'owner@delhiprints.com',
            'currency' => 'INR',
        ]);

        $this->branch = Branch::create([
            'shop_id' => $this->shop->id,
            'name' => 'Connaught Branch',
            'address' => 'B-44 Inner Circle',
            'city' => 'New Delhi',
            'phone' => '+919876543210',
            'is_active' => true,
        ]);

        $this->printer = Printer::create([
            'branch_id' => $this->branch->id,
            'name' => 'HP LaserJet Pro 404',
            'model' => 'M404dn',
            'capabilities' => ['color' => false, 'duplex' => true, 'paper_sizes' => ['A4']],
            'status' => 'idle',
            'is_active' => true,
        ]);

        PricingRule::create([
            'branch_id' => $this->branch->id,
            'paper_size' => 'A4',
            'bw_single_price' => 2.00,
            'bw_duplex_price' => 3.00,
            'color_single_price' => 10.00,
            'color_duplex_price' => 18.00,
            'duplex_pricing_mode' => 'per_side',
            'min_order_amount' => 5.00,
            'tax_rate_percent' => 18.00,
            'is_active' => true,
        ]);

        $this->order = Order::create([
            'branch_id' => $this->branch->id,
            'order_number' => 'PE-DASH-1001',
            'customer_name' => 'Amitabh Sen',
            'customer_phone' => '+919988776655',
            'subtotal_amount' => 50.00,
            'tax_amount' => 9.00,
            'total_amount' => 59.00,
            'pricing_snapshot' => ['mock' => true],
            'status' => 'COMPLETED',
            'qr_token_used' => 'branch_qr_code',
        ]);

        PrintJob::create([
            'order_id' => $this->order->id,
            'printer_id' => $this->printer->id,
            'status' => 'COMPLETED',
            'completed_at' => now(),
        ]);

        // Malicious / unrelated tenant
        $this->foreignOwner = User::factory()->create([
            'email' => 'hacker@competitor.com',
            'role' => 'shop_owner',
        ]);
    }

    public function test_shop_owner_can_view_branch_analytics(): void
    {
        Sanctum::actingAs($this->owner);

        $response = $this->getJson("/api/branches/{$this->branch->id}/analytics");

        $response->assertStatus(200)
            ->assertJsonPath('branch.name', 'Connaught Branch')
            ->assertJsonPath('analytics.orders_today_count', 1)
            ->assertJsonPath('analytics.completed_prints_today', 1)
            ->assertJsonPath('analytics.active_printers_count', 1);

        $this->assertEquals(59.0, (float) $response->json('analytics.revenue_today'));
    }

    public function test_shop_owner_can_list_branch_orders(): void
    {
        Sanctum::actingAs($this->owner);

        $response = $this->getJson("/api/branches/{$this->branch->id}/orders");

        $response->assertStatus(200)
            ->assertJsonPath('count', 1)
            ->assertJsonPath('orders.0.order_number', 'PE-DASH-1001')
            ->assertJsonPath('orders.0.customer_name', 'Amitabh Sen');
    }

    public function test_shop_owner_can_update_pricing_rules(): void
    {
        Sanctum::actingAs($this->owner);

        $response = $this->putJson("/api/branches/{$this->branch->id}/pricing-rules", [
            'rules' => [
                [
                    'paper_size' => 'A4',
                    'bw_single_price' => 3.50,
                    'bw_duplex_price' => 5.00,
                    'color_single_price' => 12.00,
                    'color_duplex_price' => 20.00,
                    'duplex_pricing_mode' => 'per_side',
                    'min_order_amount' => 10.00,
                    'tax_rate_percent' => 18.00,
                ],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Pricing rules updated successfully');

        $this->assertDatabaseHas('pricing_rules', [
            'branch_id' => $this->branch->id,
            'paper_size' => 'A4',
            'bw_single_price' => 3.50,
            'min_order_amount' => 10.00,
        ]);
    }

    public function test_shop_owner_can_add_printer_to_branch(): void
    {
        Sanctum::actingAs($this->owner);

        $response = $this->postJson("/api/branches/{$this->branch->id}/printers", [
            'name' => 'Epson EcoTank L8050',
            'model' => 'L8050 Photo',
            'connection_type' => 'usb',
            'supports_color' => true,
            'supports_duplex' => false,
            'supported_paper_sizes' => ['A4', 'Photo 4x6'],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('printer.name', 'Epson EcoTank L8050')
            ->assertJsonPath('printer.supports_color', true);

        $this->assertDatabaseHas('printers', [
            'branch_id' => $this->branch->id,
            'name' => 'Epson EcoTank L8050',
        ]);
    }

    public function test_shop_owner_can_fetch_qr_poster_data(): void
    {
        Sanctum::actingAs($this->owner);

        $response = $this->getJson("/api/branches/{$this->branch->id}/qr-poster");

        $response->assertStatus(200)
            ->assertJsonPath('poster.shop_name', 'Delhi Super Prints')
            ->assertJsonPath('poster.branch_name', 'Connaught Branch')
            ->assertJsonStructure(['poster' => ['qr_token', 'scan_url', 'steps', 'pricing_summary']]);
    }

    public function test_foreign_shop_owner_cannot_access_another_shops_dashboard_data(): void
    {
        Sanctum::actingAs($this->foreignOwner);

        $analyticsResp = $this->getJson("/api/branches/{$this->branch->id}/analytics");
        $analyticsResp->assertStatus(403);

        $ordersResp = $this->getJson("/api/branches/{$this->branch->id}/orders");
        $ordersResp->assertStatus(403);

        $pricingResp = $this->putJson("/api/branches/{$this->branch->id}/pricing-rules", ['rules' => []]);
        $pricingResp->assertStatus(403);
    }
}
