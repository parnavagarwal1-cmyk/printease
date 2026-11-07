<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Order;
use App\Models\OrderFile;
use App\Models\OrderItem;
use App\Models\PrintJob;
use App\Models\Printer;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SoundboxPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected Shop $shop;
    protected Branch $branch;
    protected Printer $printer;
    protected Order $order;

    protected function setUp(): void
    {
        parent::setUp();

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
            'name' => 'Nehru Place Counter',
            'address' => 'G-4 Computer Market',
            'city' => 'New Delhi',
            'merchant_vpa' => 'metroprint@paytm',
            'merchant_name' => 'Metro Print Solutions',
            'soundbox_provider' => 'paytm',
            'is_active' => true,
        ]);

        $this->printer = Printer::create([
            'branch_id' => $this->branch->id,
            'name' => 'Front Desk LaserJet 404',
            'model' => 'LaserJet 404',
            'connection_type' => 'usb',
            'supports_color' => false,
            'supports_duplex' => true,
            'supported_paper_sizes' => ['A4'],
            'status' => 'idle',
            'is_active' => true,
        ]);

        $this->order = Order::create([
            'branch_id' => $this->branch->id,
            'order_number' => 'PE-SND-1001',
            'customer_name' => 'Amit Verma',
            'customer_phone' => '+919876543210',
            'subtotal_amount' => 15.00,
            'tax_amount' => 2.70,
            'total_amount' => 17.70,
            'pricing_snapshot' => ['subtotal' => 15.00, 'tax_amount' => 2.70, 'total_amount' => 17.70],
            'status' => 'UPLOADED',
        ]);

        $file = OrderFile::create([
            'order_id' => $this->order->id,
            'original_filename' => 'resume.pdf',
            'storage_path' => 'orders/2026/11/07/test_resume.pdf',
            'file_hash_sha256' => hash('sha256', 'dummy resume content'),
            'mime_type' => 'application/pdf',
            'page_count' => 3,
            'file_size_bytes' => 45000,
        ]);

        OrderItem::create([
            'order_id' => $this->order->id,
            'order_file_id' => $file->id,
            'paper_size' => 'A4',
            'print_mode' => 'bw',
            'duplex_mode' => 'single',
            'selected_page_count' => 3,
            'sheet_count' => 3,
            'unit_price' => 5.00,
            'line_total' => 15.00,
        ]);
    }

    public function test_generates_dynamic_upi_qr_payload(): void
    {
        $response = $this->getJson("/api/public/orders/{$this->order->order_number}/upi-qr");

        $response->assertStatus(200)
            ->assertJsonPath('order_number', 'PE-SND-1001')
            ->assertJsonPath('upi.merchant_vpa', 'metroprint@paytm')
            ->assertJsonPath('upi.soundbox_provider', 'paytm')
            ->assertJsonStructure([
                'upi' => ['upi_uri', 'qr_code_url', 'app_intents' => ['gpay', 'phonepe', 'paytm']],
            ]);

        $upiUri = $response->json('upi.upi_uri');
        $this->assertStringContainsString('pa=metroprint%40paytm', $upiUri);
        $this->assertStringContainsString('am=17.70', $upiUri);
        $this->assertStringContainsString('tr=PE-SND-1001', $upiUri);
    }

    public function test_processes_paytm_soundbox_webhook_and_enqueues_print_job(): void
    {
        $payload = [
            'ORDERID' => $this->order->order_number,
            'TXNAMOUNT' => '17.70',
            'TXNID' => 'ptm_txn_88992211',
            'BANKTXNID' => '412389102345',
            'STATUS' => 'TXN_SUCCESS',
            'RESPCODE' => '01',
        ];

        $response = $this->postJson('/api/webhooks/paytm', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'SUCCESS')
            ->assertJsonPath('order.status', 'PRINT_QUEUED');

        $this->assertDatabaseHas('orders', [
            'id' => $this->order->id,
            'status' => 'PRINT_QUEUED',
        ]);

        $this->assertDatabaseHas('payments', [
            'order_id' => $this->order->id,
            'gateway' => 'paytm_soundbox',
            'razorpay_payment_id' => 'ptm_txn_88992211',
            'status' => 'captured',
        ]);

        $this->assertDatabaseHas('print_jobs', [
            'order_id' => $this->order->id,
            'status' => 'PRINT_QUEUED',
        ]);
    }

    public function test_processes_phonepe_soundbox_webhook_and_enqueues_print_job(): void
    {
        $payload = [
            'response' => base64_encode(json_encode([
                'data' => [
                    'merchantTransactionId' => $this->order->order_number,
                    'transactionId' => 'php_txn_445566',
                    'amount' => 1770, // In paise
                    'state' => 'COMPLETED',
                ],
            ])),
        ];

        $response = $this->postJson('/api/webhooks/phonepe', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('status', 'SUCCESS')
            ->assertJsonPath('order.status', 'PRINT_QUEUED');

        $this->assertDatabaseHas('orders', [
            'id' => $this->order->id,
            'status' => 'PRINT_QUEUED',
        ]);

        $this->assertDatabaseHas('payments', [
            'order_id' => $this->order->id,
            'gateway' => 'phonepe_soundbox',
            'razorpay_payment_id' => 'php_txn_445566',
            'status' => 'captured',
        ]);
    }

    public function test_simulates_soundbox_confirmation(): void
    {
        $response = $this->postJson('/api/webhooks/soundbox/simulate', [
            'order_number' => $this->order->order_number,
            'provider' => 'paytm',
            'utr' => 'UTR998877665544',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('order.status', 'PRINT_QUEUED');

        $this->assertDatabaseHas('payments', [
            'order_id' => $this->order->id,
            'gateway' => 'paytm_soundbox',
            'razorpay_payment_id' => 'UTR998877665544',
            'status' => 'captured',
        ]);
    }
}
