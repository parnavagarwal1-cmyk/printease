<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentWebhookEvent;
use App\Services\SoundboxPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SoundboxWebhookController extends Controller
{
    protected SoundboxPaymentService $soundboxService;

    public function __construct(SoundboxPaymentService $soundboxService)
    {
        $this->soundboxService = $soundboxService;
    }

    /**
     * Get dynamic UPI QR code and deep links for an order
     */
    public function getUpiQr(string $orderNumber): JsonResponse
    {
        $order = Order::where('order_number', $orderNumber)->with(['branch'])->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $payload = $this->soundboxService->generateUpiPayload($order);

        return response()->json([
            'order_number' => $order->order_number,
            'total_amount' => (float) $order->total_amount,
            'status' => $order->status,
            'upi' => $payload,
        ]);
    }

    /**
     * Paytm for Business Instant Payment Notification Webhook
     */
    public function handlePaytmWebhook(Request $request, ?string $branchToken = null): JsonResponse
    {
        $payload = $request->all();
        $orderNumber = $payload['ORDERID'] ?? $payload['orderId'] ?? null;

        if (!$orderNumber) {
            return response()->json(['message' => 'Missing ORDERID parameter'], 422);
        }

        try {
            $order = $this->soundboxService->handlePaytmWebhook($payload, $branchToken);

            return response()->json([
                'status' => 'SUCCESS',
                'message' => 'Paytm payment processed, print job dispatched to spooler.',
                'order' => $order,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'FAILED',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * PhonePe Merchant Webhook
     */
    public function handlePhonePeWebhook(Request $request, ?string $branchToken = null): JsonResponse
    {
        $payload = $request->all();

        try {
            $order = $this->soundboxService->handlePhonePeWebhook($payload, $branchToken);

            return response()->json([
                'status' => 'SUCCESS',
                'message' => 'PhonePe payment processed, print job dispatched to spooler.',
                'order' => $order,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'FAILED',
                'message' => $e->getMessage(),
            ], 400);
        }
    }

    /**
     * Simulate Soundbox Confirmation (For Testing / Manual Shop Approval)
     */
    public function simulateWebhook(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_number' => ['required', 'string'],
            'provider' => ['nullable', 'string', 'in:paytm,phonepe'],
            'utr' => ['nullable', 'string', 'max:50'],
        ]);

        $order = Order::where('order_number', $validated['order_number'])->first();
        if (!$order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $provider = ($validated['provider'] ?? 'paytm') . '_soundbox';
        $txnId = $validated['utr'] ?? ('sim_' . rand(100000000000, 999999999999));

        $updatedOrder = $this->soundboxService->completeSoundboxOrderPayment(
            $order,
            $provider,
            $txnId,
            (float) $order->total_amount,
            ['simulated' => true, 'provider' => $provider, 'utr' => $txnId]
        );

        return response()->json([
            'message' => "Soundbox payment confirmed ({$provider}), job sent to print spooler!",
            'order' => $updatedOrder,
        ]);
    }
}
