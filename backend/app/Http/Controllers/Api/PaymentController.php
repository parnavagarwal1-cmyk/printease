<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentWebhookEvent;
use App\Services\RazorpayPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    protected RazorpayPaymentService $paymentService;

    public function __construct(RazorpayPaymentService $paymentService)
    {
        $this->paymentService = $paymentService;
    }

    /**
     * Initiate payment for an existing order.
     */
    public function initiatePayment(string $orderNumber): JsonResponse
    {
        $order = Order::where('order_number', $orderNumber)->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        if (in_array($order->status, ['PAID', 'PRINT_QUEUED', 'PRINTING', 'COMPLETED'])) {
            return response()->json([
                'message' => 'This order has already been paid and queued for printing.',
                'order' => $order,
            ], 400);
        }

        $razorpayData = $this->paymentService->createRazorpayOrder($order);

        return response()->json([
            'message' => 'Payment initiated successfully.',
            'order_number' => $order->order_number,
            'razorpay' => $razorpayData,
        ]);
    }

    /**
     * Verify payment signature returned by checkout modal.
     */
    public function verifyPayment(Request $request, string $orderNumber): JsonResponse
    {
        $order = Order::where('order_number', $orderNumber)->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        $validated = $request->validate([
            'razorpay_order_id' => ['required', 'string'],
            'razorpay_payment_id' => ['required', 'string'],
            'razorpay_signature' => ['required', 'string'],
        ]);

        $isValid = $this->paymentService->verifyPaymentSignature(
            $validated['razorpay_order_id'],
            $validated['razorpay_payment_id'],
            $validated['razorpay_signature']
        );

        if (!$isValid) {
            return response()->json([
                'message' => 'Invalid payment signature. Verification failed.',
            ], 400);
        }

        $completedOrder = $this->paymentService->completeOrderPayment(
            $order,
            $validated['razorpay_payment_id'],
            $validated['razorpay_signature'],
            $request->all()
        );

        return response()->json([
            'message' => 'Payment verified and print job queued successfully.',
            'order' => $completedOrder,
        ]);
    }

    /**
     * Handle asynchronous Razorpay webhooks (Idempotent).
     */
    public function handleWebhook(Request $request): JsonResponse
    {
        $rawPayload = $request->getContent();
        $signature = $request->header('X-Razorpay-Signature');

        if (empty($signature)) {
            return response()->json(['message' => 'Missing X-Razorpay-Signature header.'], 400);
        }

        $isValid = $this->paymentService->verifyWebhookSignature($rawPayload, $signature);
        if (!$isValid) {
            return response()->json(['message' => 'Invalid webhook signature.'], 400);
        }

        $data = json_decode($rawPayload, true) ?? [];
        $eventId = $data['id'] ?? ('wh_' . md5($rawPayload));
        $eventType = $data['event'] ?? 'unknown';

        // Check idempotency
        $existingEvent = PaymentWebhookEvent::where('event_id', $eventId)->first();
        if ($existingEvent && $existingEvent->is_processed) {
            return response()->json([
                'message' => 'Webhook event already processed (idempotent).',
                'event_id' => $eventId,
            ], 200);
        }

        $webhookRecord = $existingEvent ?? PaymentWebhookEvent::create([
            'event_id' => $eventId,
            'event_type' => $eventType,
            'payload' => $data,
            'is_processed' => false,
        ]);

        try {
            if (in_array($eventType, ['payment.captured', 'order.paid'])) {
                $paymentPayload = $data['payload']['payment']['entity'] ?? [];
                $orderPayload = $data['payload']['order']['entity'] ?? [];

                $receipt = $orderPayload['receipt'] ?? ($paymentPayload['notes']['order_number'] ?? null);
                $paymentId = $paymentPayload['id'] ?? ('pay_' . Str::random(14));
                $orderId = $orderPayload['id'] ?? ($paymentPayload['order_id'] ?? null);

                $order = null;
                if ($receipt) {
                    $order = Order::where('order_number', $receipt)->first();
                }

                if (!$order && $orderId) {
                    $order = Order::whereHas('payments', function ($q) use ($orderId) {
                        $q->where('razorpay_order_id', $orderId);
                    })->first();
                }

                if ($order) {
                    $this->paymentService->completeOrderPayment(
                        $order,
                        $paymentId,
                        $signature,
                        $data
                    );
                }
            }

            $webhookRecord->update([
                'is_processed' => true,
                'processed_at' => now(),
            ]);

            return response()->json([
                'message' => 'Webhook processed successfully.',
                'event_id' => $eventId,
            ], 200);
        } catch (\Throwable $e) {
            $webhookRecord->update([
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Webhook processing failed: ' . $e->getMessage(),
            ], 500);
        }
    }
}
