<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\Branch;
use App\Models\DesktopDevice;
use App\Models\Plan;
use App\Models\PricingRule;
use App\Models\Printer;
use App\Models\QrCode;
use App\Models\Shop;
use App\Models\ShopMember;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Subscription Plans
        $starterPlan = Plan::firstOrCreate(
            ['slug' => 'starter'],
            [
                'name' => 'Starter',
                'monthly_price' => 499.00,
                'max_branches' => 1,
                'max_printers_per_branch' => 2,
                'monthly_print_limit' => 2000,
                'features' => ['QR Self-Service', 'Basic Pricing', '1 Device Agent'],
                'is_active' => true,
            ]
        );

        $proPlan = Plan::firstOrCreate(
            ['slug' => 'pro'],
            [
                'name' => 'Pro Hub',
                'monthly_price' => 1299.00,
                'max_branches' => 3,
                'max_printers_per_branch' => 5,
                'monthly_print_limit' => 10000,
                'features' => ['Multi-branch Hub', 'Dynamic Duplex Pricing', '3 Device Agents', 'Audit Logs'],
                'is_active' => true,
            ]
        );

        Plan::firstOrCreate(
            ['slug' => 'fleet'],
            [
                'name' => 'Enterprise Fleet',
                'monthly_price' => 2999.00,
                'max_branches' => 10,
                'max_printers_per_branch' => 15,
                'monthly_print_limit' => null,
                'features' => ['Unlimited Printers', 'Custom GST Invoicing', 'Priority Queue', 'Dedicated Webhooks'],
                'is_active' => true,
            ]
        );

        // 2. Super Admin User
        $superAdmin = User::updateOrCreate(
            ['email' => 'parnavagarwal1@gmail.com'],
            [
                'name' => 'Pranav Agarwal',
                'password' => Hash::make('Pranav143@'),
                'phone' => '+919876543210',
                'role' => 'super_admin',
                'is_active' => true,
            ]
        );

        AuditLog::create([
            'user_id' => $superAdmin->id,
            'shop_id' => null,
            'action' => 'seed_initialized',
            'entity_type' => 'system',
            'entity_id' => null,
            'ip_address' => '127.0.0.1',
            'details' => ['message' => 'Production plans and super admin initialized successfully'],
        ]);
    }
}
