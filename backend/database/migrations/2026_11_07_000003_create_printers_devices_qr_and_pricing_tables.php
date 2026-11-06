<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 4. Printers
        Schema::create('printers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->onDelete('cascade');
            $table->string('name');
            $table->string('system_printer_name')->nullable(); // Exact OS name e.g. "HP LaserJet Pro MFP M126nw"
            $table->string('model')->nullable();
            $table->json('capabilities')->nullable(); // {"color": true, "duplex": true, "paper_sizes": ["A4", "A3"]}
            $table->boolean('is_default')->default(false);
            $table->string('status', 20)->default('online'); // online, offline, jam, busy
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['branch_id', 'is_active']);
        });

        // 5. Desktop Devices (Windows Electron PCs)
        Schema::create('desktop_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->onDelete('cascade');
            $table->string('device_name');
            $table->string('device_uuid', 64)->unique();
            $table->string('pairing_code', 16)->nullable()->unique();
            $table->timestamp('pairing_code_expires_at')->nullable();
            $table->string('auth_token_hash', 64)->nullable(); // SHA-256 hash of device API token
            $table->string('app_version', 20)->nullable();
            $table->string('os_info')->nullable();
            $table->foreignId('selected_printer_id')->nullable()->constrained('printers')->onDelete('set null');
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->string('status', 20)->default('standby'); // online, offline, standby, printing
            $table->timestamps();

            $table->index(['branch_id', 'status']);
            $table->index('pairing_code');
        });

        // 6. QR Codes (Unique unguessable tokens for branches)
        Schema::create('qr_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->onDelete('cascade');
            $table->string('token', 64)->unique(); // 32 to 64 char unguessable random string
            $table->string('label')->default('Main Counter');
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('scan_count')->default(0);
            $table->timestamp('last_scanned_at')->nullable();
            $table->timestamps();

            $table->index('token');
            $table->index(['branch_id', 'is_active']);
        });

        // 7. Pricing Rules (Configurable per branch)
        Schema::create('pricing_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('branches')->onDelete('cascade');
            $table->string('paper_size', 20)->default('A4'); // A4, A3, Letter, Legal
            $table->decimal('bw_single_price', 8, 2)->default(2.00);
            $table->decimal('bw_duplex_price', 8, 2)->default(3.00);
            $table->decimal('color_single_price', 8, 2)->default(10.00);
            $table->decimal('color_duplex_price', 8, 2)->default(18.00);
            $table->string('duplex_pricing_mode', 20)->default('per_side'); // 'per_side' or 'per_sheet'
            $table->decimal('min_order_amount', 8, 2)->default(5.00);
            $table->decimal('tax_rate_percent', 5, 2)->default(0.00);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['branch_id', 'paper_size']);
            $table->index(['branch_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pricing_rules');
        Schema::dropIfExists('qr_codes');
        Schema::dropIfExists('desktop_devices');
        Schema::dropIfExists('printers');
    }
};
