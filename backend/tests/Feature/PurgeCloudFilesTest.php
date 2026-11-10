<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\OrderFile;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PurgeCloudFilesTest extends TestCase
{
    use RefreshDatabase;

    protected Shop $shop;
    protected Branch $branch;
    protected Printer $printer;
    protected Order $order;
    protected OrderFile $orderFile;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $user = User::factory()->create();
        $this->shop = Shop::create([
            'name' => 'Metro Express Print',
            'slug' => 'metro-express-print',
            'owner_id' => $user->id,
            'contact_email' => 'metro@prints.com',
            'currency' => 'INR',
        ]);

        $this->branch = Branch::create([
            'shop_id' => $this->shop->id,
            'name' => 'Main Branch',
            'code' => 'BR-01',
            'address' => 'Counter 1',
            'city' => 'Delhi',
            'merchant_vpa' => 'metro@upi',
            'merchant_name' => 'Metro Print',
            'soundbox_provider' => 'phonepe',
            'is_active' => true,
        ]);

        $this->printer = Printer::create([
            'branch_id' => $this->branch->id,
            'name' => 'HP LaserJet Pro',
            'is_active' => true,
        ]);

        $this->order = Order::create([
            'branch_id' => $this->branch->id,
            'order_number' => 'PE-TEST-FILE-01',
            'customer_name' => 'Customer Test',
            'customer_phone' => '9988776655',
            'subtotal_amount' => 10.00,
            'tax_amount' => 0.00,
            'total_amount' => 10.00,
            'pricing_snapshot' => ['bw_single_price' => 2.0],
            'status' => 'PRINT_QUEUED',
        ]);

        // Put a fake PDF file into fake private storage
        $testPath = 'orders/2026/11/10/test_document.pdf';
        Storage::disk('local')->put($testPath, 'fake pdf content');

        $this->orderFile = OrderFile::create([
            'order_id' => $this->order->id,
            'original_filename' => 'aadhaar_card.pdf',
            'storage_path' => $testPath,
            'file_hash_sha256' => hash('sha256', 'fake pdf content'),
            'mime_type' => 'application/pdf',
            'page_count' => 2,
            'file_size_bytes' => 1024,
        ]);
    }

    public function test_purge_files_method_deletes_file_and_updates_database(): void
    {
        $this->assertTrue(Storage::disk('local')->exists($this->orderFile->storage_path));

        $purgedCount = $this->order->purgeFiles();

        $this->assertEquals(1, $purgedCount);
        $this->assertFalse(Storage::disk('local')->exists('orders/2026/11/10/test_document.pdf'));

        $this->orderFile->refresh();
        $this->assertEquals('[PURGED]', $this->orderFile->storage_path);
        $this->assertNotNull($this->orderFile->purged_at);
    }

    public function test_desktop_job_completion_triggers_immediate_file_purge(): void
    {
        $device = \App\Models\DesktopDevice::create([
            'branch_id' => $this->branch->id,
            'device_name' => 'WinAgent-Counter',
            'device_uuid' => 'win-mach-uuid-001',
            'auth_token_hash' => hash('sha256', 'secret-token-123'),
            'status' => 'online',
        ]);

        $job = PrintJob::create([
            'order_id' => $this->order->id,
            'printer_id' => $this->printer->id,
            'job_lease_token' => 'lease-token-abc',
            'claimed_by_device_id' => $device->id,
            'status' => 'PRINTING',
        ]);

        $this->assertTrue(Storage::disk('local')->exists($this->orderFile->storage_path));

        // Desktop agent notifies job completion
        $response = $this->withHeaders([
            'X-Device-Token' => 'secret-token-123',
        ])->postJson("/api/desktop/jobs/{$job->id}/status", [
            'job_lease_token' => 'lease-token-abc',
            'status' => 'COMPLETED',
        ]);

        $response->assertStatus(200);

        // Document must be deleted from cloud storage immediately
        $this->assertFalse(Storage::disk('local')->exists('orders/2026/11/10/test_document.pdf'));

        $this->order->refresh();
        $this->assertEquals('COMPLETED', $this->order->status);

        $this->orderFile->refresh();
        $this->assertEquals('[PURGED]', $this->orderFile->storage_path);
        $this->assertNotNull($this->orderFile->purged_at);
    }

    public function test_artisan_purge_command_cleans_up_orphaned_and_completed_files(): void
    {
        // Mark order completed
        $this->order->update(['status' => 'COMPLETED']);

        $this->assertTrue(Storage::disk('local')->exists($this->orderFile->storage_path));

        $this->artisan('printease:purge-files --hours=0')
            ->assertExitCode(0);

        $this->assertFalse(Storage::disk('local')->exists('orders/2026/11/10/test_document.pdf'));

        $this->orderFile->refresh();
        $this->assertEquals('[PURGED]', $this->orderFile->storage_path);
    }
}
