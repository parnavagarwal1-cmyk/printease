<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\DesktopDevice;
use App\Models\Order;
use App\Models\OrderFile;
use App\Models\OrderItem;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class DesktopJobWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected Shop $shop;
    protected Branch $branch1;
    protected Branch $branch2;
    protected DesktopDevice $device1;
    protected DesktopDevice $device2;
    protected string $rawToken1;
    protected string $rawToken2;
    protected Printer $printer1;
    protected Order $order1;
    protected OrderFile $orderFile1;
    protected PrintJob $printJob1;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $user = User::factory()->create();
        $this->shop = Shop::create([
            'name' => 'Metro Express',
            'slug' => 'metro-express',
            'owner_id' => $user->id,
            'contact_email' => 'metro@prints.com',
            'currency' => 'INR',
        ]);

        $this->branch1 = Branch::create([
            'shop_id' => $this->shop->id,
            'name' => 'Branch Alpha',
            'is_active' => true,
        ]);

        $this->branch2 = Branch::create([
            'shop_id' => $this->shop->id,
            'name' => 'Branch Beta',
            'is_active' => true,
        ]);

        $this->printer1 = Printer::create([
            'branch_id' => $this->branch1->id,
            'name' => 'Front Desk HP 404',
            'model' => 'LaserJet 404',
            'connection_type' => 'usb',
            'supports_color' => false,
            'supports_duplex' => true,
            'supported_paper_sizes' => ['A4'],
            'status' => 'idle',
            'is_active' => true,
        ]);

        // Device 1 at Branch 1
        $this->rawToken1 = 'dtk_' . Str::random(48);
        $this->device1 = DesktopDevice::create([
            'branch_id' => $this->branch1->id,
            'device_name' => 'Counter PC 1',
            'device_uuid' => 'win-counter-1',
            'auth_token_hash' => hash('sha256', $this->rawToken1),
            'status' => 'online',
        ]);

        // Device 2 also at Branch 1 (for testing concurrent claiming / conflict)
        $this->rawToken2 = 'dtk_' . Str::random(48);
        $this->device2 = DesktopDevice::create([
            'branch_id' => $this->branch1->id,
            'device_name' => 'Counter PC 2',
            'device_uuid' => 'win-counter-2',
            'auth_token_hash' => hash('sha256', $this->rawToken2),
            'status' => 'online',
        ]);

        // Create sample order at Branch 1
        $this->order1 = Order::create([
            'branch_id' => $this->branch1->id,
            'order_number' => 'PE-JOB-1100',
            'customer_name' => 'Vikram Patel',
            'customer_phone' => '+919876543210',
            'subtotal_amount' => 10.00,
            'tax_amount' => 1.80,
            'total_amount' => 11.80,
            'pricing_snapshot' => ['mock' => true],
            'status' => 'PRINT_QUEUED',
            'qr_token_used' => 'branch_alpha_qr',
        ]);

        // Create dummy file in fake storage
        $testStoragePath = 'orders/2026/11/07/contract.pdf';
        Storage::disk('local')->put($testStoragePath, '%PDF-1.4 Mock PDF Content For Testing Spooler');

        $this->orderFile1 = OrderFile::create([
            'order_id' => $this->order1->id,
            'original_filename' => 'contract.pdf',
            'storage_path' => $testStoragePath,
            'file_hash_sha256' => hash('sha256', '%PDF-1.4 Mock PDF Content For Testing Spooler'),
            'mime_type' => 'application/pdf',
            'page_count' => 2,
            'file_size_bytes' => 48,
        ]);

        OrderItem::create([
            'order_id' => $this->order1->id,
            'order_file_id' => $this->orderFile1->id,
            'page_range' => 'all',
            'selected_page_count' => 2,
            'copies' => 1,
            'paper_size' => 'A4',
            'print_mode' => 'bw',
            'duplex_mode' => 'duplex',
            'sheet_count' => 1,
            'unit_price' => 3.00,
            'line_total' => 3.00,
        ]);

        $this->printJob1 = PrintJob::create([
            'order_id' => $this->order1->id,
            'printer_id' => $this->printer1->id,
            'status' => 'PRINT_QUEUED',
        ]);
    }

    public function test_paired_device_can_poll_pending_jobs(): void
    {
        $response = $this->withHeader('X-Device-Token', $this->rawToken1)
            ->getJson('/api/desktop/jobs/poll');

        $response->assertStatus(200)
            ->assertJsonPath('count', 1)
            ->assertJsonPath('jobs.0.order_number', 'PE-JOB-1100')
            ->assertJsonPath('jobs.0.file.original_filename', 'contract.pdf')
            ->assertJsonPath('jobs.0.options.duplex_mode', 'duplex');
    }

    public function test_unauthorized_device_cannot_poll(): void
    {
        $response = $this->getJson('/api/desktop/jobs/poll');
        $response->assertStatus(401);

        $badResponse = $this->withHeader('X-Device-Token', 'invalid_random_token')
            ->getJson('/api/desktop/jobs/poll');
        $badResponse->assertStatus(401);
    }

    public function test_device_claims_job_atomically_with_lease_lock(): void
    {
        $response = $this->withHeader('X-Device-Token', $this->rawToken1)
            ->postJson("/api/desktop/jobs/{$this->printJob1->id}/claim");

        $response->assertStatus(200)
            ->assertJsonStructure(['job_lease_token', 'leased_until', 'download_url']);

        $leaseToken = $response->json('job_lease_token');
        $this->assertNotEmpty($leaseToken);

        $this->assertDatabaseHas('print_jobs', [
            'id' => $this->printJob1->id,
            'claimed_by_device_id' => $this->device1->id,
            'job_lease_token' => $leaseToken,
            'status' => 'DOWNLOADING',
        ]);
    }

    public function test_second_device_cannot_claim_already_leased_job(): void
    {
        // Device 1 claims job
        $this->withHeader('X-Device-Token', $this->rawToken1)
            ->postJson("/api/desktop/jobs/{$this->printJob1->id}/claim");

        // Device 2 attempts to claim while lease is active
        $response = $this->withHeader('X-Device-Token', $this->rawToken2)
            ->postJson("/api/desktop/jobs/{$this->printJob1->id}/claim");

        $response->assertStatus(409)
            ->assertJsonPath('message', 'Conflict: Print job is already leased to another device');
    }

    public function test_expired_lease_can_be_reclaimed(): void
    {
        // Simulate a job leased to device 1 that crashed 10 minutes ago
        $this->printJob1->update([
            'claimed_by_device_id' => $this->device1->id,
            'job_lease_token' => 'old_expired_lease',
            'leased_until' => now()->subMinutes(10),
            'status' => 'DOWNLOADING',
        ]);

        // Device 2 claims it
        $response = $this->withHeader('X-Device-Token', $this->rawToken2)
            ->postJson("/api/desktop/jobs/{$this->printJob1->id}/claim");

        $response->assertStatus(200);

        $this->assertDatabaseHas('print_jobs', [
            'id' => $this->printJob1->id,
            'claimed_by_device_id' => $this->device2->id,
            'status' => 'DOWNLOADING',
        ]);
    }

    public function test_downloads_file_with_valid_lease_token(): void
    {
        // 1. Claim
        $claimResp = $this->withHeader('X-Device-Token', $this->rawToken1)
            ->postJson("/api/desktop/jobs/{$this->printJob1->id}/claim");
        $leaseToken = $claimResp->json('job_lease_token');

        // 2. Download
        $response = $this->withHeaders([
            'X-Device-Token' => $this->rawToken1,
            'X-Job-Lease-Token' => $leaseToken,
        ])->get("/api/desktop/jobs/{$this->printJob1->id}/download");

        $response->assertStatus(200);
        $this->assertEquals('%PDF-1.4 Mock PDF Content For Testing Spooler', $response->streamedContent());
        $response->assertHeader('Content-Type', 'application/pdf');

        $this->assertNotNull($this->printJob1->fresh()->downloaded_at);
    }

    public function test_rejects_download_without_valid_lease(): void
    {
        $response = $this->withHeaders([
            'X-Device-Token' => $this->rawToken1,
            'X-Job-Lease-Token' => 'forged_fake_lease_token',
        ])->get("/api/desktop/jobs/{$this->printJob1->id}/download");

        $response->assertStatus(403);
    }

    public function test_updates_job_status_and_records_telemetry(): void
    {
        // 1. Claim
        $claimResp = $this->withHeader('X-Device-Token', $this->rawToken1)
            ->postJson("/api/desktop/jobs/{$this->printJob1->id}/claim");
        $leaseToken = $claimResp->json('job_lease_token');

        // 2. Update to SUBMITTED_TO_SPOOLER
        $spoolResp = $this->withHeader('X-Device-Token', $this->rawToken1)
            ->postJson("/api/desktop/jobs/{$this->printJob1->id}/status", [
                'job_lease_token' => $leaseToken,
                'status' => 'SUBMITTED_TO_SPOOLER',
                'spooler_job_id' => 'win-spool-8841',
                'telemetry' => ['spool_time_ms' => 340],
            ]);
        $spoolResp->assertStatus(200);

        $this->assertDatabaseHas('print_jobs', [
            'id' => $this->printJob1->id,
            'status' => 'SUBMITTED_TO_SPOOLER',
            'spooler_job_id' => 'win-spool-8841',
        ]);

        // 3. Update to COMPLETED
        $compResp = $this->withHeader('X-Device-Token', $this->rawToken1)
            ->postJson("/api/desktop/jobs/{$this->printJob1->id}/status", [
                'job_lease_token' => $leaseToken,
                'status' => 'COMPLETED',
                'telemetry' => ['total_duration_ms' => 1250, 'sheets_printed' => 1],
            ]);
        $compResp->assertStatus(200);

        $this->assertDatabaseHas('print_jobs', [
            'id' => $this->printJob1->id,
            'status' => 'COMPLETED',
        ]);

        // Parent order should also be marked completed
        $this->assertDatabaseHas('orders', [
            'id' => $this->order1->id,
            'status' => 'COMPLETED',
        ]);

        // Telemetry attempt should be recorded
        $this->assertDatabaseHas('print_job_attempts', [
            'print_job_id' => $this->printJob1->id,
            'device_id' => $this->device1->id,
            'status' => 'SUCCESS',
        ]);
    }
}
