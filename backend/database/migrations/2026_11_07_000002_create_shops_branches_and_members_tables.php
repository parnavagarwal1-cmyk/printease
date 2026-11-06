<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Shops (Tenants)
        Schema::create('shops', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('contact_email');
            $table->string('contact_phone', 20)->nullable();
            $table->string('gst_number', 30)->nullable();
            $table->string('status', 20)->default('active'); // active, suspended, past_due
            $table->foreignId('owner_id')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            $table->index('status');
        });

        // 2. Branches
        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops')->onDelete('cascade');
            $table->string('name');
            $table->string('code', 20)->nullable(); // e.g. MAIN, B1
            $table->string('address')->nullable();
            $table->string('city', 100)->nullable();
            $table->string('state', 100)->nullable();
            $table->string('pincode', 20)->nullable();
            $table->string('phone', 20)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['shop_id', 'is_active']);
        });

        // 3. Shop Members (Multi-user tenant assignment)
        Schema::create('shop_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('set null');
            $table->string('role', 30)->default('staff'); // shop_owner, branch_manager, staff
            $table->timestamps();

            $table->unique(['shop_id', 'user_id']);
            $table->index(['shop_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_members');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('shops');
    }
};
