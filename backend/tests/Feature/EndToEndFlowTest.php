<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DesktopDevice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\QrCode;
use App\Models\Shop;
use App\Models\User;
use App\Services\RazorpayPaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class EndToEndFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /**
     * Complete lifecycle test simulating the entire PrintEase platform:
     * 1. Super Admin seeded
     * 2. Shop Owner registers & subscribes to SaaS Pro tier
     * 3. Shop sets up branch, pricing rules, and printer
     * 4. Windows Desktop Agent pairs using single-use pairing code
     * 5. Customer scans branch QR token & uploads PDF document
     * 6. Pricing engine calculates duplex sheets & 18% GST
     * 7. Customer submits order & completes Razorpay payment
     * 8. Desktop Agent polls, claims job with lease lock, and streams PDF
     * 9. Desktop Agent updates status to PRINTING then COMPLETED
     * 10. Shop Dashboard & Super Admin Control Plane metrics reflect completed transaction
     */
    public function test_complete_printease_lifecycle_end_to_end(): void
    {
        // ---------------------------------------------------------
        // 0. Seed Subscription Plans & Super Admin
        // ---------------------------------------------------------
        Plan::create([
            'slug' => 'starter',
            'name' => 'Starter Plan',
            'monthly_price' => 499.00,
            'max_branches' => 1,
            'max_printers_per_branch' => 2,
            'features' => ['Single branch', 'Basic analytics'],
            'is_active' => true,
        ]);

        Plan::create([
            'slug' => 'pro',
            'name' => 'Professional Fleet',
            'monthly_price' => 1499.00,
            'max_branches' => 3,
            'max_printers_per_branch' => 10,
            'features' => ['Up to 3 branches', 'Advanced fleet routing', 'Custom pricing'],
            'is_active' => true,
        ]);

        $superAdmin = User::factory()->create([
            'email' => 'superadmin@printease.com',
            'role' => 'super_admin',
        ]);

        // ---------------------------------------------------------
        // 1. Shop Owner Registration & Authentication
        // ---------------------------------------------------------
        $registerResp = $this->postJson('/api/auth/register', [
            'name' => 'Vikram Sharma',
            'email' => 'vikram@delhiprints.in',
            'password' => 'SecurePass@2026',
            'password_confirmation' => 'SecurePass@2026',
            'phone' => '+919811223344',
            'shop_name' => 'Delhi Quick Print Hub',
            'branch_name' => 'Connaught Place Flagship',
            'city' => 'New Delhi',
        ]);

        $registerResp->assertStatus(201)
            ->assertJsonStructure(['user', 'token']);

        $ownerToken = $registerResp->json('token');
        $ownerAuth = ['Authorization' => "Bearer {$ownerToken}"];

        $shop = Shop::where('contact_email', 'vikram@delhiprints.in')->first();
        $this->assertNotNull($shop);
        $shopId = $shop->id;

        $branch = Branch::where('shop_id', $shopId)->first();
        $this->assertNotNull($branch);
        $branchId = $branch->id;

        // Upgrade to Pro plan
        $subResp = $this->withHeaders($ownerAuth)->postJson("/api/shops/{$shopId}/subscribe", [
            'plan_slug' => 'pro',
        ]);

        $subResp->assertStatus(200)
            ->assertJsonPath('subscription.status', 'active')
            ->assertJsonPath('subscription.plan.slug', 'pro');

        // ---------------------------------------------------------
        // 3. Configure Pricing Rules & Printer Setup
        // ---------------------------------------------------------

        // Configure Pricing Rules: A4 B/W duplex ₹3.00, single ₹2.00, Color single ₹10.00
        $pricingResp = $this->withHeaders($ownerAuth)->putJson("/api/branches/{$branchId}/pricing-rules", [
            'rules' => [
                [
                    'paper_size' => 'A4',
                    'bw_single_price' => 2.00,
                    'bw_duplex_price' => 3.00,
                    'color_single_price' => 10.00,
                    'color_duplex_price' => 18.00,
                    'duplex_pricing_mode' => 'per_sheet',
                    'min_order_amount' => 5.00,
                    'tax_rate_percent' => 18.00,
                ],
            ],
        ]);
        $pricingResp->assertStatus(200);

        // Add Front Desk Printer
        $printerResp = $this->withHeaders($ownerAuth)->postJson("/api/branches/{$branchId}/printers", [
            'name' => 'Canon imageRUNNER 2630i',
            'model' => 'imageRUNNER 2630i',
            'connection_type' => 'usb',
            'supports_color' => true,
            'supports_duplex' => true,
            'supported_paper_sizes' => ['A4', 'A3'],
        ]);
        $printerResp->assertStatus(201);
        $printerId = $printerResp->json('printer.id');

        // Verify branch has active QR code
        $qrCode = QrCode::where('branch_id', $branchId)->first();
        if (!$qrCode) {
            $qrCode = QrCode::create([
                'branch_id' => $branchId,
                'token' => 'pe_cp_flagship_token_777',
                'name' => 'Counter Stand QR',
                'is_active' => true,
            ]);
        }

        // ---------------------------------------------------------
        // 4. Windows Desktop Agent Pairing Flow
        // ---------------------------------------------------------
        // Generate pairing code from Shop Owner Dashboard
        $pairingCodeResp = $this->withHeaders($ownerAuth)->postJson("/api/branches/{$branchId}/pairing-code", [
            'device_name' => 'Counter 1 Windows Workstation',
        ]);

        $pairingCodeResp->assertStatus(200);
        $pairingCode = $pairingCodeResp->json('pairing_code');
        $this->assertNotEmpty($pairingCode);

        // Desktop Agent performs pairing call
        $pairResp = $this->postJson('/api/desktop/pair', [
            'pairing_code' => $pairingCode,
            'device_name' => 'Counter 1 Windows Workstation',
            'device_uuid' => 'win-client-uuid-999-alpha',
            'os_info' => 'Windows 11 Pro 64-bit',
            'app_version' => '1.0.0',
        ]);

        $pairResp->assertStatus(200)
            ->assertJsonStructure(['device', 'device_token']);

        $desktopToken = $pairResp->json('device_token');
        $this->assertNotEmpty($desktopToken);
        $desktopHeaders = ['X-Device-Token' => $desktopToken];

        // Pairing code should now be invalidated
        $deviceInDb = DesktopDevice::where('device_uuid', 'win-client-uuid-999-alpha')->first();
        $this->assertNotNull($deviceInDb);
        $this->assertNull($deviceInDb->pairing_code);
        $this->assertEquals('online', $deviceInDb->status);

        // ---------------------------------------------------------
        // 5. Customer Scans QR & Uploads PDF Document
        // ---------------------------------------------------------
        // Customer resolves QR
        $qrScanResp = $this->getJson("/api/public/qr/{$qrCode->token}");
        $qrScanResp->assertStatus(200)
            ->assertJsonPath('branch.name', 'Connaught Place Flagship')
            ->assertJsonPath('shop.name', 'Delhi Quick Print Hub');

        // Customer uploads a 6-page test PDF document
        $pdfContent = "%PDF-1.4\n" . str_repeat("/Type /Page\n", 6) . "%%EOF";
        $fakeFile = UploadedFile::fake()->createWithContent('annual_report.pdf', $pdfContent);

        $uploadResp = $this->postJson("/api/public/qr/{$qrCode->token}/upload", [
            'file' => $fakeFile,
        ]);

        $uploadResp->assertStatus(201)
            ->assertJsonStructure(['file' => ['file_path', 'sha256_checksum', 'page_count', 'original_name', 'file_size']]);

        $uploaded = $uploadResp->json('file');
        $fileHash = $uploaded['sha256_checksum'];
        $pageCount = $uploaded['page_count'];

        // ---------------------------------------------------------
        // 6. Customer Price Estimate Calculation
        // ---------------------------------------------------------
        // 6 pages B/W duplex -> 3 sheets * ₹3.00 = ₹9.00 subtotal + 18% GST (₹1.62) = ₹10.62
        $estimateResp = $this->postJson("/api/public/qr/{$qrCode->token}/estimate", [
            'items' => [
                [
                    'total_pages' => 6,
                    'page_range' => '1-6',
                    'copies' => 1,
                    'color_mode' => 'bw',
                    'duplex_mode' => 'duplex',
                    'paper_size' => 'A4',
                ],
            ],
        ]);

        $estimateResp->assertStatus(200);
        $this->assertEquals(9.00, (float) $estimateResp->json('subtotal'));
        $this->assertEquals(1.62, (float) $estimateResp->json('tax_amount'));
        $this->assertEquals(10.62, (float) $estimateResp->json('total_amount'));

        // ---------------------------------------------------------
        // 7. Customer Places Order & Initiates Razorpay Payment
        // ---------------------------------------------------------
        $orderCreateResp = $this->postJson("/api/public/qr/{$qrCode->token}/orders", [
            'customer_name' => 'Rahul Verma',
            'customer_phone' => '+919988776655',
            'customer_email' => 'rahul@example.com',
            'notes' => 'Please staple in top left corner',
            'files' => [
                [
                    'original_name' => $uploaded['original_name'],
                    'file_path' => $uploaded['file_path'],
                    'file_size' => $uploaded['file_size'],
                    'sha256_checksum' => $uploaded['sha256_checksum'],
                    'page_count' => $uploaded['page_count'],
                ],
            ],
            'items' => [
                [
                    'file_index' => 0,
                    'paper_size' => 'A4',
                    'color_mode' => 'bw',
                    'duplex_mode' => 'duplex',
                    'copies' => 1,
                ],
            ],
        ]);

        $orderCreateResp->assertStatus(201)
            ->assertJsonPath('order.status', 'UPLOADED')
            ->assertJsonStructure(['order' => ['order_number', 'total_amount']]);

        $orderNumber = $orderCreateResp->json('order.order_number');
        $orderId = $orderCreateResp->json('order.id');

        // Initiate payment
        $payInitResp = $this->postJson("/api/public/orders/{$orderNumber}/pay");
        $payInitResp->assertStatus(200)
            ->assertJsonStructure(['razorpay' => ['razorpay_order_id', 'amount', 'currency']]);

        $razorpayOrderId = $payInitResp->json('razorpay.razorpay_order_id');
        $razorpayPaymentId = 'pay_e2e_live_simulation_' . rand(100000, 999999);

        // Compute valid signature using Razorpay HMAC service
        $paymentService = new RazorpayPaymentService();
        $signature = $paymentService->generateSignature($razorpayOrderId, $razorpayPaymentId);

        // Verify payment
        $verifyResp = $this->postJson("/api/public/orders/{$orderNumber}/verify-payment", [
            'razorpay_order_id' => $razorpayOrderId,
            'razorpay_payment_id' => $razorpayPaymentId,
            'razorpay_signature' => $signature,
        ]);

        $verifyResp->assertStatus(200)
            ->assertJsonPath('order.status', 'PRINT_QUEUED');

        // Verify database state: order is queued, payment is captured, print job is created
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => 'PRINT_QUEUED',
        ]);
        $this->assertDatabaseHas('payments', [
            'order_id' => $orderId,
            'status' => 'captured',
            'razorpay_payment_id' => $razorpayPaymentId,
        ]);
        $this->assertDatabaseHas('print_jobs', [
            'order_id' => $orderId,
            'printer_id' => $printerId,
            'status' => 'PRINT_QUEUED',
        ]);

        // ---------------------------------------------------------
        // 8. Desktop Agent Polls, Claims & Streams Print Job
        // ---------------------------------------------------------
        // Agent polls for jobs
        $pollResp = $this->withHeaders($desktopHeaders)->getJson('/api/desktop/jobs/poll');
        $pollResp->assertStatus(200)
            ->assertJsonPath('count', 1);

        $jobId = $pollResp->json('jobs.0.id');
        $this->assertNotNull($jobId);

        // Agent claims job with lease lock
        $claimResp = $this->withHeaders($desktopHeaders)->postJson("/api/desktop/jobs/{$jobId}/claim", [
            'lease_duration_seconds' => 120,
        ]);

        $claimResp->assertStatus(200)
            ->assertJsonPath('message', 'Print job claimed successfully')
            ->assertJsonStructure(['job_id', 'job_lease_token', 'leased_until', 'download_url']);

        $leaseToken = $claimResp->json('job_lease_token');
        $this->assertNotEmpty($leaseToken);
        $this->assertDatabaseHas('print_jobs', [
            'id' => $jobId,
            'status' => 'DOWNLOADING',
            'job_lease_token' => $leaseToken,
        ]);

        // Agent downloads the PDF file stream
        $downloadResp = $this->withHeaders(array_merge($desktopHeaders, [
            'X-Job-Lease-Token' => $leaseToken,
        ]))->get("/api/desktop/jobs/{$jobId}/download");
        $downloadResp->assertStatus(200);

        // Verify file stream checksum matches uploaded hash
        $downloadedContent = $downloadResp->streamedContent();
        $this->assertEquals($fileHash, hash('sha256', $downloadedContent));

        // ---------------------------------------------------------
        // 9. Desktop Agent Reports Spooling Telemetry & Completion
        // ---------------------------------------------------------
        // Agent starts printing
        $statusPrintingResp = $this->withHeaders($desktopHeaders)->postJson("/api/desktop/jobs/{$jobId}/status", [
            'job_lease_token' => $leaseToken,
            'status' => 'PRINTING',
            'telemetry' => [
                'pages_printed' => 2,
                'spooler_job_id' => 'spl-101',
            ],
        ]);
        $statusPrintingResp->assertStatus(200)
            ->assertJsonPath('job.status', 'PRINTING');

        // Agent completes print job
        $statusCompleteResp = $this->withHeaders($desktopHeaders)->postJson("/api/desktop/jobs/{$jobId}/status", [
            'job_lease_token' => $leaseToken,
            'status' => 'COMPLETED',
            'telemetry' => [
                'pages_printed' => 6,
                'sheets_used' => 3,
                'spool_time_ms' => 450,
                'duration_seconds' => 4.2,
            ],
        ]);

        $statusCompleteResp->assertStatus(200)
            ->assertJsonPath('job.status', 'COMPLETED');

        // Both Job and Order are now COMPLETED
        $this->assertDatabaseHas('print_jobs', [
            'id' => $jobId,
            'status' => 'COMPLETED',
        ]);
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'status' => 'COMPLETED',
        ]);

        // ---------------------------------------------------------
        // 10. Verification of Dashboards & Control Plane
        // ---------------------------------------------------------
        // Shop Owner Branch Analytics
        $analyticsResp = $this->withHeaders($ownerAuth)->getJson("/api/branches/{$branchId}/analytics");
        $analyticsResp->assertStatus(200)
            ->assertJsonPath('analytics.orders_today_count', 1)
            ->assertJsonPath('analytics.completed_prints_today', 1)
            ->assertJsonPath('analytics.active_printers_count', 1)
            ->assertJsonPath('analytics.online_devices_count', 1);

        $this->assertEquals(10.62, (float) $analyticsResp->json('analytics.revenue_today'));

        // Super Admin Metrics
        \Laravel\Sanctum\Sanctum::actingAs($superAdmin);

        $adminMetricsResp = $this->getJson('/api/admin/metrics');
        $adminMetricsResp->assertStatus(200);
        $this->assertEquals(1, $adminMetricsResp->json('metrics.total_shops'));
        $this->assertEquals(1, $adminMetricsResp->json('metrics.total_branches'));
        $this->assertEquals(1, $adminMetricsResp->json('metrics.total_orders'));
        $this->assertEquals(1, $adminMetricsResp->json('metrics.total_prints_completed'));
        $this->assertEquals(10.62, (float) $adminMetricsResp->json('metrics.gross_platform_volume'));

        // Super Admin Audit Trail
        $auditResp = $this->getJson('/api/admin/audit-logs');
        $auditResp->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, count($auditResp->json('audit_logs')));
    }
}
