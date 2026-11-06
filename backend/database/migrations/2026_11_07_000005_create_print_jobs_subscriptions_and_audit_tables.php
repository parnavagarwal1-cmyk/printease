<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 13. Print Jobs (Discrete physical printing lifecycle)
        Schema::create('print_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->onDelete('cascade');
            $table->foreignId('printer_id')->constrained('printers')->onDelete('cascade');
            $table->foreignId('claimed_by_device_id')->nullable()->constrained('desktop_devices')->onDelete('set null');
            $table->string('status', 30)->default('PRINT_QUEUED');
            // PRINT_QUEUED, DOWNLOADING, PRINTING, SUBMITTED_TO_SPOOLER, COMPLETED, PRINT_FAILED, UNKNOWN, CANCELLED
            $table->string('job_lease_token', 64)->nullable()->unique();
            $table->timestamp('leased_until')->nullable(); // Multi-device lock lease
            $table->timestamp('downloaded_at')->nullable();
            $table->timestamp('spooled_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('spooler_job_id', 64)->nullable();
            $table->timestamps();

            $table->index(['printer_id', 'status']);
            $table->index(['claimed_by_device_id', 'status']);
            $table->index('leased_until');
        });

        // 14. Print Job Attempts (Telemetry & error reconciliation)
        Schema::create('print_job_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('print_job_id')->constrained('print_jobs')->onDelete('cascade');
            $table->foreignId('device_id')->nullable()->constrained('desktop_devices')->onDelete('set null');
            $table->unsignedInteger('attempt_number')->default(1);
            $table->string('status', 30); // SUCCESS, FAILED, TIMEOUT, UNKNOWN
            $table->text('error_message')->nullable();
            $table->json('telemetry')->nullable(); // ink/paper levels, execution duration
            $table->timestamps();

            $table->index('print_job_id');
        });

        // 15. Subscription Plans
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // Starter, Pro, Fleet
            $table->string('slug')->unique();
            $table->decimal('monthly_price', 8, 2);
            $table->unsignedInteger('max_branches')->default(1);
            $table->unsignedInteger('max_printers_per_branch')->default(2);
            $table->unsignedInteger('monthly_print_limit')->nullable(); // null for unlimited
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // 16. Subscriptions
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops')->onDelete('cascade');
            $table->foreignId('plan_id')->constrained('plans')->onDelete('cascade');
            $table->string('status', 20)->default('active'); // active, trialing, past_due, cancelled
            $table->timestamp('starts_at');
            $table->timestamp('ends_at')->nullable();
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamps();

            $table->index(['shop_id', 'status']);
        });

        // 17. Audit Logs
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('shop_id')->nullable()->constrained('shops')->onDelete('cascade');
            $table->string('action', 50); // login, update_pricing, pair_device, void_job
            $table->string('entity_type', 50)->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->json('details')->nullable();
            $table->timestamps();

            $table->index(['shop_id', 'action']);
            $table->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('plans');
        Schema::dropIfExists('print_job_attempts');
        Schema::dropIfExists('print_jobs');
    }
};
