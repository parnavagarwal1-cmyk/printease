<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_files', function (Blueprint $table) {
            $table->timestamp('purged_at')->nullable()->after('expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('order_files', function (Blueprint $table) {
            $table->dropColumn('purged_at');
        });
    }
};
