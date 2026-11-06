<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\PricingRule;
use App\Models\Printer;
use App\Models\QrCode;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublicOrderTest extends TestCase
{
    use RefreshDatabase;

    protected Shop $shop;
    protected Branch $branch;
    protected QrCode $qrCode;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $user = User::factory()->create();
        $this->shop = Shop::create([
            'name' => 'Connaught Fast Prints',
            'slug' => 'connaught-fast-prints',
            'owner_id' => $user->id,
            'contact_email' => 'connaught@prints.com',
            'currency' => 'INR',
        ]);

        $this->branch = Branch::create([
            'shop_id' => $this->shop->id,
            'name' => 'Main Center',
            'address' => 'A-12 Inner Circle',
            'city' => 'New Delhi',
            'phone' => '+919876543210',
            'is_active' => true,
        ]);

        Printer::create([
            'branch_id' => $this->branch->id,
            'name' => 'HP LaserJet MFP M428',
            'model' => 'LaserJet Pro',
            'connection_type' => 'usb',
            'supports_color' => false,
            'supports_duplex' => true,
            'supported_paper_sizes' => ['A4', 'Legal'],
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

        $this->qrCode = QrCode::create([
            'branch_id' => $this->branch->id,
            'token' => 'pe_test_valid_token_12345',
            'name' => 'Counter QR 1',
            'is_active' => true,
            'scan_count' => 0,
        ]);
    }

    public function test_resolves_valid_qr_code(): void
    {
        $response = $this->getJson("/api/public/qr/{$this->qrCode->token}");

        $response->assertStatus(200)
            ->assertJsonPath('branch.name', 'Main Center')
            ->assertJsonPath('shop.name', 'Connaught Fast Prints')
            ->assertJsonPath('printers.0.name', 'HP LaserJet MFP M428');

        $this->assertDatabaseHas('qr_codes', [
            'id' => $this->qrCode->id,
            'scan_count' => 1,
        ]);
    }

    public function test_returns_404_for_invalid_qr_code(): void
    {
        $response = $this->getJson('/api/public/qr/non_existent_token');
        $response->assertStatus(404);
    }

    public function test_calculates_live_estimate(): void
    {
        $response = $this->postJson("/api/public/qr/{$this->qrCode->token}/estimate", [
            'items' => [
                [
                    'total_pages' => 4,
                    'page_range' => 'all',
                    'copies' => 1,
                    'color_mode' => 'bw',
                    'duplex_mode' => 'single',
                    'paper_size' => 'A4',
                ],
            ],
        ]);

        $response->assertStatus(200);
        $this->assertEquals(8.0, (float) $response->json('subtotal'));
        $this->assertEquals(9.44, (float) $response->json('total_amount'));
    }

    public function test_uploads_pdf_to_private_storage(): void
    {
        $file = UploadedFile::fake()->create('assignment.pdf', 500, 'application/pdf');

        $response = $this->postJson("/api/public/qr/{$this->qrCode->token}/upload", [
            'file' => $file,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('file.original_name', 'assignment.pdf')
            ->assertJsonStructure(['file' => ['file_path', 'sha256_checksum', 'page_count']]);

        $filePath = $response->json('file.file_path');
        Storage::disk('local')->assertExists($filePath);
    }

    public function test_rejects_non_pdf_upload(): void
    {
        $file = UploadedFile::fake()->create('malicious.exe', 100, 'application/octet-stream');

        $response = $this->postJson("/api/public/qr/{$this->qrCode->token}/upload", [
            'file' => $file,
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['file']);
    }

    public function test_creates_customer_order_with_status_uploaded(): void
    {
        // First upload file
        $file = UploadedFile::fake()->create('thesis.pdf', 300, 'application/pdf');
        $uploadResp = $this->postJson("/api/public/qr/{$this->qrCode->token}/upload", [
            'file' => $file,
        ]);
        $uploaded = $uploadResp->json('file');

        $response = $this->postJson("/api/public/qr/{$this->qrCode->token}/orders", [
            'customer_name' => 'Rahul Sharma',
            'customer_phone' => '+919988776655',
            'customer_email' => 'rahul@example.com',
            'notes' => 'Please staple in top left corner',
            'files' => [
                [
                    'original_name' => $uploaded['original_name'],
                    'file_path' => $uploaded['file_path'],
                    'file_size' => $uploaded['file_size'],
                    'sha256_checksum' => $uploaded['sha256_checksum'],
                    'page_count' => 10,
                ],
            ],
            'items' => [
                [
                    'file_index' => 0,
                    'paper_size' => 'A4',
                    'color_mode' => 'bw',
                    'duplex_mode' => 'duplex',
                    'copies' => 2,
                    'page_range' => '1-5',
                ],
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('order.customer_name', 'Rahul Sharma')
            ->assertJsonPath('order.status', 'UPLOADED');

        $orderNumber = $response->json('order.order_number');
        $this->assertNotEmpty($orderNumber);

        // Verify status lookup endpoint
        $statusResp = $this->getJson("/api/public/orders/{$orderNumber}");
        $statusResp->assertStatus(200)
            ->assertJsonPath('order.order_number', $orderNumber)
            ->assertJsonPath('order.customer_name', 'Rahul Sharma')
            ->assertJsonPath('order.status', 'UPLOADED');
    }
}
