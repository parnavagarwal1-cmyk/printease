<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use App\Models\PrintJob;
use App\Models\Printer;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SoundboxPaymentService
{
    /**
     * Generate dynamic UPI payment payload with pre-filled amount and order reference
     */
    public function generateUpiPayload(Order $order): array
    {
        $branch = $order->branch;
        if ($branch) {
            $branch->loadMissing('shop');
        }
        $amount = number_format((float) $order->total_amount, 2, '.', '');
        $vpa = ($branch && $branch->merchant_vpa) ? $branch->merchant_vpa : 'metroprint@paytm';
        $payeeName = ($branch && $branch->merchant_name) 
            ? $branch->merchant_name 
            : (($branch && $branch->shop) ? $branch->shop->name : ($branch->name ?? 'PrintEase Merchant'));
        $orderNumber = $order->order_number;
        $note = "PrintEase Order {$orderNumber}";

        $query = http_build_query([
            'pa' => $vpa,
            'pn' => $payeeName,
            'am' => $amount,
            'tr' => $orderNumber,
            'tn' => $note,
            'cu' => 'INR',
        ]);

        $upiUri = "upi://pay?{$query}";
        $qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" . urlencode($upiUri);

        return [
            'order_number' => $orderNumber,
            'amount' => (float) $amount,
            'currency' => 'INR',
            'merchant_vpa' => $vpa,
            'merchant_name' => $payeeName,
            'soundbox_provider' => $branch->soundbox_provider ?? 'paytm',
            'upi_uri' => $upiUri,
            'qr_code_url' => $qrCodeUrl,
            'app_intents' => [
                'gpay' => "gpay://upi/pay?{$query}",
                'phonepe' => "phonepe://upi/pay?{$query}",
                'paytm' => "paytmmp://pay?{$query}",
            ],
        ];
    }

    /**
     * Process incoming Paytm for Business webhook
     */
    public function handlePaytmWebhook(array $payload, ?string $branchToken = null): Order
    {
        $orderNumber = $payload['ORDERID'] ?? $payload['orderId'] ?? null;
        $status = $payload['STATUS'] ?? $payload['status'] ?? null;
        $txnId = $payload['TXNID'] ?? $payload['txnId'] ?? ('ptm_' . Str::random(12));
        $amount = (float) ($payload['TXNAMOUNT'] ?? $payload['txnAmount'] ?? 0);

        if (!$orderNumber) {
            throw new \InvalidArgumentException('Missing ORDERID in Paytm webhook payload.');
        }

        $order = Order::where('order_number', $orderNumber)->firstOrFail();

        if ($status !== 'TXN_SUCCESS' && $status !== 'SUCCESS') {
            throw new \DomainException("Paytm transaction was not successful: {$status}");
        }

        return $this->completeSoundboxOrderPayment($order, 'paytm_soundbox', $txnId, $amount, $payload);
    }

    /**
     * Process incoming PhonePe Business webhook
     */
    public function handlePhonePeWebhook(array $payload, ?string $branchToken = null): Order
    {
        // PhonePe sends base64 response or direct payload
        $data = $payload;
        if (isset($payload['response']) && is_string($payload['response'])) {
            $decoded = base64_decode($payload['response']);
            if ($decoded) {
                $data = json_decode($decoded, true) ?? $payload;
            }
        }

        $paymentData = $data['data'] ?? $data;
        $orderNumber = $paymentData['merchantTransactionId'] ?? $paymentData['orderId'] ?? null;
        $state = $paymentData['state'] ?? $paymentData['code'] ?? null;
        $txnId = $paymentData['transactionId'] ?? ('php_' . Str::random(12));
        $rawAmount = $paymentData['amount'] ?? 0;
        $amount = $rawAmount > 100 ? ($rawAmount / 100) : (float) $rawAmount; // PhonePe sends in paise

        if (!$orderNumber) {
            throw new \InvalidArgumentException('Missing merchantTransactionId in PhonePe webhook payload.');
        }

        $order = Order::where('order_number', $orderNumber)->firstOrFail();

        if ($state !== 'COMPLETED' && $state !== 'PAYMENT_SUCCESS') {
            throw new \DomainException("PhonePe transaction was not successful: {$state}");
        }

        return $this->completeSoundboxOrderPayment($order, 'phonepe_soundbox', $txnId, (float) $amount, $payload);
    }

    /**
     * Complete soundbox payment and enqueue physical print job (Atomic & Idempotent)
     */
    public function completeSoundboxOrderPayment(
        Order $order,
        string $provider,
        string $txnId,
        float $amount,
        ?array $rawPayload = null
    ): Order {
        return DB::transaction(function () use ($order, $provider, $txnId, $amount, $rawPayload) {
            $lockedOrder = Order::where('id', $order->id)
                ->with(['items', 'branch.printers'])
                ->lockForUpdate()
                ->firstOrFail();

            // Idempotency: If already paid or queued, return immediately
            if (in_array($lockedOrder->status, ['PAID', 'PRINT_QUEUED', 'DOWNLOADING', 'PRINTING', 'COMPLETED'])) {
                return $lockedOrder;
            }

            // Create or update Payment record
            Payment::updateOrCreate(
                ['order_id' => $lockedOrder->id],
                [
                    'gateway' => $provider,
                    'razorpay_order_id' => 'sb_' . $lockedOrder->order_number,
                    'razorpay_payment_id' => $txnId,
                    'amount' => $amount ?: $lockedOrder->total_amount,
                    'currency' => 'INR',
                    'status' => 'captured',
                    'gateway_response' => $rawPayload,
                    'verified_at' => now(),
                ]
            );

            // Match suitable active printer in branch
            $printers = $lockedOrder->branch->printers()->where('is_active', true)->get();
            $needsColor = $lockedOrder->items->contains(fn($item) => $item->print_mode === 'color');

            $selectedPrinter = null;
            if ($needsColor) {
                $selectedPrinter = $printers->firstWhere('supports_color', true) ?? $printers->first();
            } else {
                $selectedPrinter = $printers->first();
            }

            if (!$selectedPrinter) {
                $selectedPrinter = Printer::firstOrCreate(
                    ['branch_id' => $lockedOrder->branch_id, 'name' => 'Default Counter Printer'],
                    [
                        'model' => 'Standard Spooler',
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
            PrintJob::create([
                'order_id' => $lockedOrder->id,
                'printer_id' => $selectedPrinter->id,
                'status' => 'PRINT_QUEUED',
            ]);

            $lockedOrder->update(['status' => 'PRINT_QUEUED']);

            AuditLog::create([
                'user_id' => null,
                'shop_id' => $lockedOrder->branch->shop_id ?? null,
                'action' => 'payment_captured_via_soundbox',
                'entity_type' => 'order',
                'entity_id' => $lockedOrder->id,
                'ip_address' => request()->ip() ?? '127.0.0.1',
                'details' => [
                    'provider' => $provider,
                    'txn_id' => $txnId,
                    'amount' => $amount,
                    'order_number' => $lockedOrder->order_number,
                ],
            ]);

            return $lockedOrder->fresh();
        });
    }
}
