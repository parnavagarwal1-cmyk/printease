<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PrintJob;
use App\Models\Printer;
use Exception;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class RazorpayPaymentService
{
    protected string $keyId;
    protected string $keySecret;
    protected string $webhookSecret;

    public function __construct()
    {
        $this->keyId = config('services.razorpay.key_id', 'rzp_test_mock_12345');
        $this->keySecret = config('services.razorpay.key_secret', 'mock_secret_key_67890');
        $this->webhookSecret = config('services.razorpay.webhook_secret', 'mock_webhook_secret_abc123');
    }

    /**
     * Resolve Razorpay API credentials for a specific order (Shop Branch scoped).
     */
    public function getCredentialsForOrder(Order $order): array
    {
        $branch = $order->branch ?? ($order->relationLoaded('branch') ? $order->branch : $order->branch()->first());
        if ($branch && $branch->razorpay_enabled && !empty($branch->razorpay_key_id) && !empty($branch->razorpay_key_secret)) {
            return [
                'key_id' => $branch->razorpay_key_id,
                'key_secret' => $branch->razorpay_key_secret,
                'is_custom' => true,
            ];
        }

        return [
            'key_id' => $this->keyId,
            'key_secret' => $this->keySecret,
            'is_custom' => false,
        ];
    }

    /**
     * Create Razorpay Order for a customer print order.
     */
    public function createRazorpayOrder(Order $order): array
    {
        $creds = $this->getCredentialsForOrder($order);
        $keyId = $creds['key_id'];
        $keySecret = $creds['key_secret'];

        $amountInPaise = (int) round(((float) $order->total_amount) * 100);

        // Check if there is already an existing pending payment with valid razorpay_order_id
        $existingPayment = Payment::where('order_id', $order->id)
            ->where('status', 'pending')
            ->whereNotNull('razorpay_order_id')
            ->latest()
            ->first();

        if ($existingPayment) {
            return [
                'razorpay_order_id' => $existingPayment->razorpay_order_id,
                'key_id' => $keyId,
                'amount' => $amountInPaise,
                'currency' => 'INR',
                'order_number' => $order->order_number,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'customer_email' => $order->customer_email,
            ];
        }

        $razorpayOrderId = null;
        $gatewayResponse = null;

        // If configured with live/real Razorpay test credentials
        if (!str_contains($keyId, 'mock') && !empty($keySecret)) {
            try {
                $response = Http::withBasicAuth($keyId, $keySecret)
                    ->post('https://api.razorpay.com/v1/orders', [
                        'amount' => $amountInPaise,
                        'currency' => 'INR',
                        'receipt' => $order->order_number,
                        'notes' => [
                            'order_id' => $order->id,
                            'branch_id' => $order->branch_id,
                            'customer_phone' => $order->customer_phone,
                        ],
                    ]);

                if ($response->successful()) {
                    $responseData = $response->json();
                    $razorpayOrderId = $responseData['id'];
                    $gatewayResponse = $responseData;
                } else {
                    throw new Exception('Razorpay API error: ' . $response->body());
                }
            } catch (\Throwable $e) {
                // If API fails (e.g. offline sandbox or invalid mock credentials), fallback to test mock order
                $razorpayOrderId = 'order_' . Str::random(14);
                $gatewayResponse = ['mock' => true, 'error' => $e->getMessage()];
            }
        } else {
            // Local dev / test mode mock order ID
            $razorpayOrderId = 'order_' . Str::random(14);
            $gatewayResponse = ['mock' => true];
        }

        // Record pending payment
        Payment::create([
            'order_id' => $order->id,
            'gateway' => 'razorpay',
            'razorpay_order_id' => $razorpayOrderId,
            'amount' => $order->total_amount,
            'currency' => 'INR',
            'status' => 'pending',
            'gateway_response' => $gatewayResponse,
        ]);

        $order->update(['status' => 'PAYMENT_PENDING']);

        return [
            'razorpay_order_id' => $razorpayOrderId,
            'key_id' => $keyId,
            'amount' => $amountInPaise,
            'currency' => 'INR',
            'order_number' => $order->order_number,
            'customer_name' => $order->customer_name,
            'customer_phone' => $order->customer_phone,
            'customer_email' => $order->customer_email,
        ];
    }

    /**
     * Verify payment signature from checkout callback.
     */
    public function verifyPaymentSignature(
        string $razorpayOrderId,
        string $razorpayPaymentId,
        string $signature,
        ?Order $order = null
    ): bool {
        $secret = $this->keySecret;
        if ($order) {
            $creds = $this->getCredentialsForOrder($order);
            $secret = $creds['key_secret'];
        }

        $expected = hash_hmac('sha256', $razorpayOrderId . '|' . $razorpayPaymentId, $secret);
        return hash_equals($expected, $signature);
    }

    /**
     * Verify Razorpay webhook signature.
     */
    public function verifyWebhookSignature(string $payload, string $signature): bool
    {
        $expected = hash_hmac('sha256', $payload, $this->webhookSecret);
        return hash_equals($expected, $signature);
    }

    /**
     * Transition order to PAID and enqueue physical print job (Idempotent).
     */
    public function completeOrderPayment(
        Order $order,
        string $razorpayPaymentId,
        string $signature,
        ?array $gatewayResponse = null
    ): Order {
        return DB::transaction(function () use ($order, $razorpayPaymentId, $signature, $gatewayResponse) {
            // Lock row to prevent race conditions
            $lockedOrder = Order::where('id', $order->id)
                ->with(['items', 'branch.printers'])
                ->lockForUpdate()
                ->firstOrFail();

            // Idempotency: if already paid or queued, return immediately
            if (in_array($lockedOrder->status, ['PAID', 'PRINT_QUEUED', 'PRINTING', 'COMPLETED'])) {
                return $lockedOrder;
            }

            // Update or create payment record
            $payment = Payment::where('order_id', $lockedOrder->id)->latest()->first();
            if ($payment) {
                $payment->update([
                    'razorpay_payment_id' => $razorpayPaymentId,
                    'razorpay_signature' => $signature,
                    'status' => 'captured',
                    'gateway_response' => $gatewayResponse ?? $payment->gateway_response,
                    'verified_at' => now(),
                ]);
            } else {
                Payment::create([
                    'order_id' => $lockedOrder->id,
                    'gateway' => 'razorpay',
                    'razorpay_order_id' => 'direct_' . Str::random(12),
                    'razorpay_payment_id' => $razorpayPaymentId,
                    'razorpay_signature' => $signature,
                    'amount' => $lockedOrder->total_amount,
                    'currency' => 'INR',
                    'status' => 'captured',
                    'gateway_response' => $gatewayResponse,
                    'verified_at' => now(),
                ]);
            }

            // Find matching printer in branch
            $printers = $lockedOrder->branch->printers()->where('is_active', true)->get();
            $needsColor = $lockedOrder->items->contains(fn($item) => $item->print_mode === 'color');

            $selectedPrinter = null;
            if ($needsColor) {
                $selectedPrinter = $printers->firstWhere('supports_color', true) ?? $printers->first();
            } else {
                $selectedPrinter = $printers->first();
            }

            if (!$selectedPrinter) {
                // Fallback printer if branch has none
                $selectedPrinter = Printer::firstOrCreate(
                    ['branch_id' => $lockedOrder->branch_id, 'name' => 'Default Counter Printer'],
                    [
                        'model' => 'Standard Laser',
                        'connection_type' => 'usb',
                        'supports_color' => true,
                        'supports_duplex' => true,
                        'supported_paper_sizes' => ['A4', 'A3'],
                        'status' => 'idle',
                        'is_active' => true,
                    ]
                );
            }

            // Enqueue Print Job for Windows Desktop Agent to claim
            $printJob = PrintJob::create([
                'order_id' => $lockedOrder->id,
                'printer_id' => $selectedPrinter->id,
                'status' => 'PRINT_QUEUED',
            ]);

            $lockedOrder->update(['status' => 'PRINT_QUEUED']);

            AuditLog::create([
                'user_id' => null,
                'shop_id' => $lockedOrder->branch->shop_id ?? null,
                'action' => 'payment_captured_and_job_queued',
                'entity_type' => 'order',
                'entity_id' => $lockedOrder->id,
                'ip_address' => request()->ip(),
                'details' => [
                    'order_number' => $lockedOrder->order_number,
                    'payment_id' => $razorpayPaymentId,
                    'print_job_id' => $printJob->id,
                    'printer_id' => $selectedPrinter->id,
                    'amount' => $lockedOrder->total_amount,
                ],
            ]);

            return $lockedOrder->fresh(['files', 'items', 'printJobs', 'payments']);
        });
    }

    /**
     * Helper to compute signature (useful in test mode & automated tests).
     */
    public function generateSignature(string $razorpayOrderId, string $razorpayPaymentId, ?Order $order = null): string
    {
        $secret = $this->keySecret;
        if ($order) {
            $creds = $this->getCredentialsForOrder($order);
            $secret = $creds['key_secret'];
        }

        return hash_hmac('sha256', $razorpayOrderId . '|' . $razorpayPaymentId, $secret);
    }

    /**
     * Helper to compute webhook signature (useful in automated tests).
     */
    public function generateWebhookSignature(string $payload): string
    {
        return hash_hmac('sha256', $payload, $this->webhookSecret);
    }
}
