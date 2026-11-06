<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\OrderFile;
use App\Models\OrderItem;
use App\Models\PaymentWebhookEvent;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\Shop;
use App\Models\User;
use App\Services\RazorpayPaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RazorpayPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected Shop $shop;
    protected Branch $branch;
    protected Printer $printer;
    protected Order $order;
    protected RazorpayPaymentService $paymentService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->paymentService = new RazorpayPaymentService();

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
            'name' => 'Nehru Place Branch',
            'address' => 'G-4 Computer Market',
            'city' => 'New Delhi',
            'phone' => '+919811223344',
            'is_active' => true,
        ]);

        $this->printer = Printer::create([
            'branch_id' => $this->branch->id,
            'name' => 'Canon imageRUNNER 2525',
            'model' => 'iR 2525',
            'connection_type' => 'network',
            'supports_color' => true,
            'supports_duplex' => true,
            'supported_paper_sizes' => ['A4', 'A3'],
            'status' => 'idle',
            'is_active' => true,
        ]);

        $this->order = Order::create([
            'branch_id' => $this->branch->id,
            'order_number' => 'PE-TEST-9988',
            'customer_name' => 'Priya Nair',
            'customer_phone' => '+919876501234',
            'customer_email' => 'priya@example.com',
            'subtotal_amount' => 20.00,
            'tax_amount' => 3.60,
            'total_amount' => 23.60,
            'pricing_snapshot' => ['mock' => true],
            'status' => 'UPLOADED',
            'qr_token_used' => 'pe_demo_token',
        ]);

        $orderFile = OrderFile::create([
            'order_id' => $this->order->id,
            'original_filename' => 'report.pdf',
            'storage_path' => 'orders/2026/11/07/test.pdf',
            'file_hash_sha256' => hash('sha256', 'dummy'),
            'mime_type' => 'application/pdf',
            'page_count' => 5,
            'file_size_bytes' => 10240,
        ]);

        OrderItem::create([
            'order_id' => $this->order->id,
            'order_file_id' => $orderFile->id,
            'page_range' => 'all',
            'selected_page_count' => 5,
            'copies' => 2,
            'paper_size' => 'A4',
            'print_mode' => 'color',
            'duplex_mode' => 'single',
            'sheet_count' => 10,
            'unit_price' => 2.00,
            'line_total' => 20.00,
        ]);
    }

    public function test_initiates_payment_for_order(): void
    {
        $response = $this->postJson("/api/public/orders/{$this->order->order_number}/pay");

        $response->assertStatus(200)
            ->assertJsonPath('order_number', 'PE-TEST-9988')
            ->assertJsonStructure(['razorpay' => ['razorpay_order_id', 'amount', 'currency', 'key_id']]);

        // Amount in paise: 23.60 * 100 = 2360
        $this->assertEquals(2360, $response->json('razorpay.amount'));

        $this->assertDatabaseHas('orders', [
            'id' => $this->order->id,
            'status' => 'PAYMENT_PENDING',
        ]);

        $this->assertDatabaseHas('payments', [
            'order_id' => $this->order->id,
            'status' => 'pending',
            'gateway' => 'razorpay',
        ]);
    }

    public function test_verifies_payment_with_valid_signature_and_enqueues_print_job(): void
    {
        // 1. Initiate
        $initResp = $this->postJson("/api/public/orders/{$this->order->order_number}/pay");
        $razorpayOrderId = $initResp->json('razorpay.razorpay_order_id');
        $razorpayPaymentId = 'pay_test_' . rand(100000, 999999);

        // Compute valid signature
        $validSignature = $this->paymentService->generateSignature($razorpayOrderId, $razorpayPaymentId);

        // 2. Verify
        $response = $this->postJson("/api/public/orders/{$this->order->order_number}/verify-payment", [
            'razorpay_order_id' => $razorpayOrderId,
            'razorpay_payment_id' => $razorpayPaymentId,
            'razorpay_signature' => $validSignature,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Payment verified and print job queued successfully.')
            ->assertJsonPath('order.status', 'PRINT_QUEUED');

        // Check database states
        $this->assertDatabaseHas('orders', [
            'id' => $this->order->id,
            'status' => 'PRINT_QUEUED',
        ]);

        $this->assertDatabaseHas('payments', [
            'order_id' => $this->order->id,
            'razorpay_payment_id' => $razorpayPaymentId,
            'status' => 'captured',
        ]);

        $this->assertDatabaseHas('print_jobs', [
            'order_id' => $this->order->id,
            'printer_id' => $this->printer->id,
            'status' => 'PRINT_QUEUED',
        ]);
    }

    public function test_rejects_tampered_or_invalid_signature(): void
    {
        $initResp = $this->postJson("/api/public/orders/{$this->order->order_number}/pay");
        $razorpayOrderId = $initResp->json('razorpay.razorpay_order_id');

        $response = $this->postJson("/api/public/orders/{$this->order->order_number}/verify-payment", [
            'razorpay_order_id' => $razorpayOrderId,
            'razorpay_payment_id' => 'pay_test_999999',
            'razorpay_signature' => 'invalid_forged_signature_hex',
        ]);

        $response->assertStatus(400)
            ->assertJsonPath('message', 'Invalid payment signature. Verification failed.');

        // Verify order is NOT marked paid or queued
        $this->assertDatabaseMissing('orders', [
            'id' => $this->order->id,
            'status' => 'PRINT_QUEUED',
        ]);

        $this->assertDatabaseMissing('print_jobs', [
            'order_id' => $this->order->id,
        ]);
    }

    public function test_handles_razorpay_webhook_and_enqueues_print_job(): void
    {
        $eventId = 'evt_test_' . rand(100000, 999999);
        $paymentId = 'pay_wh_' . rand(100000, 999999);

        $payload = [
            'id' => $eventId,
            'entity' => 'event',
            'event' => 'payment.captured',
            'payload' => [
                'payment' => [
                    'entity' => [
                        'id' => $paymentId,
                        'amount' => 2360,
                        'currency' => 'INR',
                        'status' => 'captured',
                        'notes' => [
                            'order_number' => $this->order->order_number,
                        ],
                    ],
                ],
                'order' => [
                    'entity' => [
                        'id' => 'order_wh_123',
                        'receipt' => $this->order->order_number,
                        'amount' => 2360,
                    ],
                ],
            ],
        ];

        $rawJson = json_encode($payload);
        $signature = $this->paymentService->generateWebhookSignature($rawJson);

        $response = $this->call(
            'POST',
            '/api/webhooks/razorpay',
            [],
            [],
            [],
            [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_RAZORPAY_SIGNATURE' => $signature,
            ],
            $rawJson
        );

        $response->assertStatus(200)
            ->assertJsonPath('event_id', $eventId);

        $this->assertDatabaseHas('payment_webhook_events', [
            'event_id' => $eventId,
            'is_processed' => true,
        ]);

        $this->assertDatabaseHas('orders', [
            'id' => $this->order->id,
            'status' => 'PRINT_QUEUED',
        ]);

        $this->assertDatabaseHas('print_jobs', [
            'order_id' => $this->order->id,
            'status' => 'PRINT_QUEUED',
        ]);
    }

    public function test_webhook_is_strictly_idempotent(): void
    {
        $eventId = 'evt_duplicate_idempotent_test';
        $paymentId = 'pay_wh_dup_123';

        $payload = [
            'id' => $eventId,
            'entity' => 'event',
            'event' => 'payment.captured',
            'payload' => [
                'payment' => [
                    'entity' => [
                        'id' => $paymentId,
                        'amount' => 2360,
                        'notes' => ['order_number' => $this->order->order_number],
                    ],
                ],
                'order' => [
                    'entity' => [
                        'id' => 'order_wh_dup',
                        'receipt' => $this->order->order_number,
                    ],
                ],
            ],
        ];

        $rawJson = json_encode($payload);
        $signature = $this->paymentService->generateWebhookSignature($rawJson);

        // 1st delivery
        $res1 = $this->call('POST', '/api/webhooks/razorpay', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_RAZORPAY_SIGNATURE' => $signature,
        ], $rawJson);
        $res1->assertStatus(200);

        // 2nd delivery (re-delivery from Razorpay)
        $res2 = $this->call('POST', '/api/webhooks/razorpay', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_RAZORPAY_SIGNATURE' => $signature,
        ], $rawJson);
        $res2->assertStatus(200);

        // Verify only 1 print job created
        $jobCount = PrintJob::where('order_id', $this->order->id)->count();
        $this->assertEquals(1, $jobCount);
    }
}
