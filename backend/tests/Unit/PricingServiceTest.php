<?php

namespace Tests\Unit;

use App\Models\Branch;
use App\Models\PricingRule;
use App\Models\Shop;
use App\Models\User;
use App\Services\PricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PricingServiceTest extends TestCase
{
    use RefreshDatabase;

    protected PricingService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new PricingService();
    }

    public function test_parses_page_ranges_correctly(): void
    {
        // "all" returns 1..10
        $all = $this->service->parsePageRange('all', 10);
        $this->assertCount(10, $all);
        $this->assertEquals([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], $all);

        // "1-4"
        $range = $this->service->parsePageRange('1-4', 10);
        $this->assertEquals([1, 2, 3, 4], $range);

        // "2, 4, 7-9"
        $mixed = $this->service->parsePageRange('2, 4, 7-9', 10);
        $this->assertEquals([2, 4, 7, 8, 9], $mixed);

        // Out of bounds clipped
        $clipped = $this->service->parsePageRange('8-15', 10);
        $this->assertEquals([8, 9, 10], $clipped);
    }

    public function test_calculates_single_sided_bw_pricing(): void
    {
        $user = User::factory()->create();
        $shop = Shop::create([
            'name' => 'Test Shop',
            'slug' => 'test-shop',
            'owner_id' => $user->id,
            'contact_email' => 'shop@test.com',
        ]);
        $branch = Branch::create(['shop_id' => $shop->id, 'name' => 'Main Branch', 'is_active' => true]);

        PricingRule::create([
            'branch_id' => $branch->id,
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

        // 5 pages, 2 copies, B&W single = 5 * 2 * 2.00 = 20.00 subtotal
        // Tax = 18% of 20 = 3.60, Total = 23.60
        $result = $this->service->calculate($branch, [
            [
                'total_pages' => 5,
                'page_range' => 'all',
                'copies' => 2,
                'color_mode' => 'bw',
                'duplex_mode' => 'single',
                'paper_size' => 'A4',
            ],
        ]);

        $this->assertEquals(20.00, $result['subtotal']);
        $this->assertEquals(3.60, $result['tax_amount']);
        $this->assertEquals(23.60, $result['total_amount']);
        $this->assertEquals(10, $result['items'][0]['total_sheets']);
    }

    public function test_enforces_minimum_order_amount(): void
    {
        $user = User::factory()->create();
        $shop = Shop::create([
            'name' => 'Test Shop 2',
            'slug' => 'test-shop-2',
            'owner_id' => $user->id,
            'contact_email' => 'shop2@test.com',
        ]);
        $branch = Branch::create(['shop_id' => $shop->id, 'name' => 'Branch 2', 'is_active' => true]);

        PricingRule::create([
            'branch_id' => $branch->id,
            'paper_size' => 'A4',
            'bw_single_price' => 2.00,
            'bw_duplex_price' => 3.00,
            'color_single_price' => 10.00,
            'color_duplex_price' => 18.00,
            'duplex_pricing_mode' => 'per_side',
            'min_order_amount' => 10.00, // min order is 10.00
            'tax_rate_percent' => 18.00,
            'is_active' => true,
        ]);

        // 1 page, 1 copy = 2.00, adjusted to min 10.00
        $result = $this->service->calculate($branch, [
            [
                'total_pages' => 1,
                'page_range' => 'all',
                'copies' => 1,
                'color_mode' => 'bw',
                'duplex_mode' => 'single',
                'paper_size' => 'A4',
            ],
        ]);

        $this->assertEquals(10.00, $result['subtotal']);
        $this->assertEquals(8.00, $result['min_order_adjustment']);
        $this->assertEquals(1.80, $result['tax_amount']);
        $this->assertEquals(11.80, $result['total_amount']);
    }
}
