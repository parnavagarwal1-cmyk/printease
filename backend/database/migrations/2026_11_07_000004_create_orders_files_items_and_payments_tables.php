<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 8. Orders
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->onDelete('cascade');
            $table->string('order_number', 32)->unique(); // e.g. ORD-20261107-XXXX
            $table->string('customer_name')->nullable();
            $table->string('customer_phone', 20)->nullable();
            $table->string('customer_email')->nullable();
            $table->decimal('subtotal_amount', 10, 2);
            $table->decimal('tax_amount', 10, 2)->default(0.00);
            $table->decimal('total_amount', 10, 2);
            $table->json('pricing_snapshot'); // Immutable snapshot of pricing rules at moment of calculation
            $table->string('status', 30)->default('UPLOADED');
            // UPLOADED, PAYMENT_PENDING, PAID, PRINT_QUEUED, DOWNLOADING, PRINTING, SUBMITTED_TO_SPOOLER, COMPLETED, PRINT_FAILED, UNKNOWN, CANCELLED, REFUND_PENDING
            $table->string('qr_token_used', 64)->nullable();
            $table->timestamps();

            $table->index(['branch_id', 'status']);
            $table->index('order_number');
            $table->index('created_at');
        });

        // 9. Order Files (Private document storage)
        Schema::create('order_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->onDelete('cascade');
            $table->string('original_filename');
            $table->string('storage_path'); // e.g. "orders/uuid.pdf" in storage/app/private
            $table->string('file_hash_sha256', 64);
            $table->string('mime_type', 50)->default('application/pdf');
            $table->unsignedInteger('page_count');
            $table->unsignedBigInteger('file_size_bytes');
            $table->timestamp('expires_at')->nullable(); // Configurable document retention policy
            $table->timestamps();

            $table->index('order_id');
            $table->index('file_hash_sha256');
        });

        // 10. Order Items (Page ranges, copies, options per file)
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->onDelete('cascade');
            $table->foreignId('order_file_id')->constrained('order_files')->onDelete('cascade');
            $table->string('page_range', 100)->default('all'); // e.g. "all" or "1-5, 8, 11-14"
            $table->unsignedInteger('selected_page_count');
            $table->unsignedInteger('copies')->default(1);
            $table->string('paper_size', 20)->default('A4');
            $table->string('print_mode', 20)->default('bw'); // 'bw' or 'color'
            $table->string('duplex_mode', 20)->default('single'); // 'single' or 'duplex'
            $table->unsignedInteger('sheet_count'); // Physical paper sheets required
            $table->decimal('unit_price', 8, 2);
            $table->decimal('line_total', 10, 2);
            $table->timestamps();

            $table->index('order_id');
        });

        // 11. Payments (Razorpay Integration)
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->onDelete('cascade');
            $table->string('gateway', 30)->default('razorpay');
            $table->string('razorpay_order_id', 64)->nullable()->unique();
            $table->string('razorpay_payment_id', 64)->nullable()->unique();
            $table->string('razorpay_signature', 128)->nullable();
            $table->decimal('amount', 10, 2);
            $table->string('currency', 10)->default('INR');
            $table->string('status', 30)->default('pending'); // pending, authorized, captured, failed, refunded
            $table->json('gateway_response')->nullable();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->index('order_id');
            $table->index('status');
        });

        // 12. Payment Webhook Events (Idempotent processing)
        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_id', 64)->unique(); // Razorpay event ID
            $table->string('event_type', 50); // e.g. "payment.captured", "payment.failed"
            $table->json('payload');
            $table->boolean('is_processed')->default(false);
            $table->timestamp('processed_at')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['event_type', 'is_processed']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhook_events');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('order_files');
        Schema::dropIfExists('orders');
    }
};
