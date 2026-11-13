<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->boolean('razorpay_enabled')->default(false)->after('soundbox_provider');
            $table->string('razorpay_key_id', 100)->nullable()->after('razorpay_enabled');
            $table->string('razorpay_key_secret', 150)->nullable()->after('razorpay_key_id');
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn(['razorpay_enabled', 'razorpay_key_id', 'razorpay_key_secret']);
        });
    }
};
