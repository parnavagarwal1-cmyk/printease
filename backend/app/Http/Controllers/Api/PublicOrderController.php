<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\Order;
use App\Models\OrderFile;
use App\Models\OrderItem;
use App\Models\QrCode;
use App\Services\PricingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PublicOrderController extends Controller
{
    protected PricingService $pricingService;

    public function __construct(PricingService $pricingService)
    {
        $this->pricingService = $pricingService;
    }

    /**
     * Resolve branch information and available capabilities from QR token.
     */
    public function resolveQr(string $token): JsonResponse
    {
        $qrCode = QrCode::where('token', $token)
            ->where('is_active', true)
            ->with(['branch.shop', 'branch.pricingRules', 'branch.printers'])
            ->first();

        if (!$qrCode || !$qrCode->branch || !$qrCode->branch->is_active) {
            return response()->json([
                'message' => 'Invalid or expired QR code. Please scan a valid shop QR code.',
            ], 404);
        }

        $branch = $qrCode->branch;
        $activePrinters = $branch->printers->where('is_active', true)->values();

        // Increment scan count
        $qrCode->increment('scan_count');
        $qrCode->update(['last_scanned_at' => now()]);

        return response()->json([
            'qr_token' => $qrCode->token,
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'address' => $branch->address,
                'city' => $branch->city,
                'phone' => $branch->phone,
            ],
            'shop' => [
                'id' => $branch->shop->id,
                'name' => $branch->shop->name,
                'logo_url' => $branch->shop->logo_url,
                'currency' => $branch->shop->currency ?? 'INR',
            ],
            'pricing_rules' => $branch->pricingRules->where('is_active', true)->values(),
            'printers' => $activePrinters->map(fn($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'capabilities' => [
                    'supports_color' => (bool) $p->supports_color,
                    'supports_duplex' => (bool) $p->supports_duplex,
                    'supported_paper_sizes' => $p->supported_paper_sizes ?? ['A4'],
                ],
                'status' => $p->status,
            ]),
        ]);
    }

    /**
     * Get live pricing estimate before creating order.
     */
    public function estimate(Request $request, string $token): JsonResponse
    {
        $branch = $this->resolveBranchFromToken($token);
        if (!$branch) {
            return response()->json(['message' => 'Invalid or expired QR code.'], 404);
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.total_pages' => ['required', 'integer', 'min:1'],
            'items.*.page_range' => ['nullable', 'string'],
            'items.*.copies' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.color_mode' => ['required', 'in:bw,color'],
            'items.*.duplex_mode' => ['required', 'in:single,duplex'],
            'items.*.paper_size' => ['required', 'string'],
        ]);

        $calculation = $this->pricingService->calculate($branch, $validated['items']);

        return response()->json($calculation);
    }

    /**
     * Upload customer document (PDF) to private secure storage.
     */
    public function uploadFile(Request $request, string $token): JsonResponse
    {
        $branch = $this->resolveBranchFromToken($token);
        if (!$branch) {
            return response()->json(['message' => 'Invalid or expired QR code.'], 404);
        }

        $request->validate([
            'file' => [
                'required',
                'file',
                'mimes:pdf',
                'max:51200', // max 50 MB
            ],
        ]);

        $uploadedFile = $request->file('file');
        $originalName = $uploadedFile->getClientOriginalName();
        $fileSize = $uploadedFile->getSize();
        $mimeType = $uploadedFile->getMimeType();
        $sha256 = hash_file('sha256', $uploadedFile->getRealPath());

        // Extract PDF page count
        $pageCount = $this->extractPdfPageCount($uploadedFile->getRealPath());

        // Save into private storage (never publicly accessible)
        $datePath = now()->format('Y/m/d');
        $storedFileName = Str::uuid() . '_' . preg_replace('/[^a-zA-Z0-9_\-\.]/', '_', $originalName);
        $storagePath = "orders/{$datePath}/{$storedFileName}";

        Storage::disk('local')->putFileAs(
            "orders/{$datePath}",
            $uploadedFile,
            $storedFileName
        );

        return response()->json([
            'message' => 'File uploaded and verified successfully',
            'file' => [
                'file_token' => Str::random(32),
                'original_name' => $originalName,
                'file_path' => $storagePath,
                'file_size' => $fileSize,
                'mime_type' => $mimeType,
                'sha256_checksum' => $sha256,
                'page_count' => $pageCount,
            ],
        ], 201);
    }

    /**
     * Create customer print order.
     */
    public function createOrder(Request $request, string $token): JsonResponse
    {
        $branch = $this->resolveBranchFromToken($token);
        if (!$branch) {
            return response()->json(['message' => 'Invalid or expired QR code.'], 404);
        }

        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_phone' => ['required', 'string', 'max:20'],
            'customer_email' => ['nullable', 'email', 'max:255'],
            'notes' => ['nullable', 'string', 'max:500'],
            'files' => ['required', 'array', 'min:1'],
            'files.*.original_name' => ['required', 'string'],
            'files.*.file_path' => ['required', 'string'],
            'files.*.file_size' => ['required', 'integer'],
            'files.*.sha256_checksum' => ['required', 'string'],
            'files.*.page_count' => ['required', 'integer', 'min:1'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.file_index' => ['required', 'integer', 'min:0'],
            'items.*.paper_size' => ['required', 'string'],
            'items.*.color_mode' => ['required', 'in:bw,color'],
            'items.*.duplex_mode' => ['required', 'in:single,duplex'],
            'items.*.copies' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.page_range' => ['nullable', 'string'],
        ]);

        // Verify all file paths exist in private storage
        foreach ($validated['files'] as $f) {
            if (!Storage::disk('local')->exists($f['file_path'])) {
                return response()->json([
                    'message' => "Uploaded file {$f['original_name']} was not found or session expired. Please re-upload.",
                ], 422);
            }
        }

        // Prepare pricing calculation payload
        $pricingItems = [];
        foreach ($validated['items'] as $item) {
            $fileIdx = $item['file_index'];
            $fileData = $validated['files'][$fileIdx] ?? null;
            $docPages = $fileData ? (int) $fileData['page_count'] : 1;

            $pricingItems[] = [
                'total_pages' => $docPages,
                'page_range' => $item['page_range'] ?? 'all',
                'copies' => (int) $item['copies'],
                'color_mode' => $item['color_mode'],
                'duplex_mode' => $item['duplex_mode'],
                'paper_size' => $item['paper_size'],
            ];
        }

        $pricing = $this->pricingService->calculate($branch, $pricingItems);

        return DB::transaction(function () use ($branch, $validated, $pricing, $request, $token) {
            // Generate friendly order number
            $orderNumber = 'PE-' . strtoupper(Str::random(4)) . '-' . rand(1000, 9999);

            $order = Order::create([
                'branch_id' => $branch->id,
                'order_number' => $orderNumber,
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'],
                'customer_email' => $validated['customer_email'] ?? null,
                'subtotal_amount' => $pricing['subtotal'],
                'tax_amount' => $pricing['tax_amount'],
                'total_amount' => $pricing['total_amount'],
                'pricing_snapshot' => $pricing,
                'status' => 'UPLOADED',
                'qr_token_used' => $token,
            ]);

            // Save order files
            $savedFiles = [];
            foreach ($validated['files'] as $f) {
                $savedFile = OrderFile::create([
                    'order_id' => $order->id,
                    'original_filename' => $f['original_name'],
                    'storage_path' => $f['file_path'],
                    'file_hash_sha256' => $f['sha256_checksum'],
                    'mime_type' => 'application/pdf',
                    'page_count' => $f['page_count'],
                    'file_size_bytes' => $f['file_size'],
                    'expires_at' => now()->addDays(7),
                ]);
                $savedFiles[] = $savedFile;
            }

            // Save order items with pricing snapshots
            foreach ($validated['items'] as $idx => $item) {
                $fileIdx = $item['file_index'];
                $orderFile = $savedFiles[$fileIdx] ?? $savedFiles[0];
                $calculated = $pricing['items'][$idx];

                OrderItem::create([
                    'order_id' => $order->id,
                    'order_file_id' => $orderFile->id,
                    'page_range' => $item['page_range'] ?? 'all',
                    'selected_page_count' => $calculated['effective_page_count'],
                    'copies' => $calculated['copies'],
                    'paper_size' => $item['paper_size'],
                    'print_mode' => $item['color_mode'],
                    'duplex_mode' => $item['duplex_mode'],
                    'sheet_count' => $calculated['total_sheets'],
                    'unit_price' => $calculated['unit_price'],
                    'line_total' => $calculated['subtotal'],
                ]);
            }

            AuditLog::create([
                'user_id' => null,
                'shop_id' => $branch->shop_id,
                'action' => 'customer_order_created',
                'entity_type' => 'order',
                'entity_id' => $order->id,
                'ip_address' => $request->ip(),
                'details' => [
                    'order_number' => $order->order_number,
                    'total_amount' => $order->total_amount,
                    'customer_phone' => $order->customer_phone,
                ],
            ]);

            return response()->json([
                'message' => 'Order created successfully. Ready for payment.',
                'order' => $order->load(['files', 'items']),
                'pricing' => $pricing,
            ], 201);
        });
    }

    /**
     * Get order status by order number.
     */
    public function getOrderStatus(string $orderNumber): JsonResponse
    {
        $order = Order::where('order_number', $orderNumber)
            ->with(['branch.shop', 'files', 'items', 'printJobs'])
            ->first();

        if (!$order) {
            return response()->json(['message' => 'Order not found.'], 404);
        }

        return response()->json([
            'order' => [
                'order_number' => $order->order_number,
                'status' => $order->status,
                'subtotal_amount' => $order->subtotal_amount,
                'tax_amount' => $order->tax_amount,
                'total_amount' => $order->total_amount,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'branch_name' => $order->branch->name,
                'shop_name' => $order->branch->shop->name,
                'items_count' => $order->items->count(),
                'created_at' => $order->created_at->toIso8601String(),
                'print_jobs' => $order->printJobs->map(fn($j) => [
                    'id' => $j->id,
                    'job_number' => $j->job_number,
                    'status' => $j->status,
                    'claimed_at' => $j->claimed_at,
                    'completed_at' => $j->completed_at,
                    'error_reason' => $j->error_reason,
                ]),
            ],
        ]);
    }

    /**
     * Safely count pages of PDF file from header/catalog.
     */
    private function extractPdfPageCount(string $filePath): int
    {
        try {
            $content = @file_get_contents($filePath);
            if ($content === false) {
                return 1;
            }

            // Pattern 1: /Count (\d+) in Pages object
            if (preg_match('/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/i', $content, $matches)) {
                return max(1, (int) $matches[1]);
            }

            // Pattern 2: Count number of /Type /Page occurrences
            $matches = [];
            preg_match_all('/\/Type\s*\/Page[^s]/i', $content, $matches);
            $pageCount = count($matches[0]);
            if ($pageCount > 0) {
                return $pageCount;
            }

            return 1;
        } catch (\Throwable $e) {
            return 1;
        }
    }

    /**
     * Helper to resolve active branch from QR token.
     */
    private function resolveBranchFromToken(string $token): ?Branch
    {
        $qrCode = QrCode::where('token', $token)
            ->where('is_active', true)
            ->with(['branch.shop', 'branch.pricingRules'])
            ->first();

        return ($qrCode && $qrCode->branch && $qrCode->branch->is_active)
            ? $qrCode->branch
            : null;
    }
}
