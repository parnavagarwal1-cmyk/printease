<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('branches') && !Schema::hasColumn('branches', 'default_paper_size')) {
            Schema::table('branches', function (Blueprint $table) {
                $table->string('default_paper_size', 20)->default('A4')->after('soundbox_provider');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('branches') && Schema::hasColumn('branches', 'default_paper_size')) {
            Schema::table('branches', function (Blueprint $table) {
                $table->dropColumn('default_paper_size');
            });
        }
    }
};
