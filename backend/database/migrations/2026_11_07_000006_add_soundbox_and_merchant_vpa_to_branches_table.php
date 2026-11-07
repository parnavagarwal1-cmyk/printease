<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->string('merchant_vpa', 100)->nullable()->after('phone');
            $table->string('merchant_name', 150)->nullable()->after('merchant_vpa');
            $table->string('soundbox_provider', 30)->default('paytm')->after('merchant_name'); // paytm, phonepe, direct_upi
        });
    }

    public function down(): void
    {
        Schema::table('branches', function (Blueprint $table) {
            $table->dropColumn(['merchant_vpa', 'merchant_name', 'soundbox_provider']);
        });
    }
};
