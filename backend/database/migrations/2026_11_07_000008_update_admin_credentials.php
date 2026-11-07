<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Hash;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Update or create parnavagarwal1@gmail.com with Super Admin role and requested password
        $parnav = User::where('email', 'parnavagarwal1@gmail.com')->first();
        if ($parnav) {
            $parnav->update([
                'password' => Hash::make('Pranav143@'),
                'role' => 'super_admin',
                'is_active' => true,
            ]);
        } else {
            User::create([
                'name' => 'Pranav Agarwal',
                'email' => 'parnavagarwal1@gmail.com',
                'password' => Hash::make('Pranav143@'),
                'phone' => '+919876543210',
                'role' => 'super_admin',
                'is_active' => true,
            ]);
        }

        // 2. Also ensure default superadmin@printease.com password is sync'd
        $defaultAdmin = User::where('email', 'superadmin@printease.com')->first();
        if ($defaultAdmin) {
            $defaultAdmin->update([
                'password' => Hash::make('Pranav143@'),
                'role' => 'super_admin',
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
    }
};
