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

        // 3. Default Shop & Branch
        $demoShop = Shop::firstOrCreate(
            ['slug' => 'printease-demo'],
            [
                'name' => 'PrintEase Counter Hub',
                'contact_email' => 'parnavagarwal1@gmail.com',
                'contact_phone' => '+919876543210',
                'status' => 'active',
                'owner_id' => $superAdmin->id,
            ]
        );

        $demoBranch = Branch::firstOrCreate(
            ['shop_id' => $demoShop->id, 'name' => 'Main Branch'],
            [
                'code' => 'MAIN',
                'city' => 'Delhi',
                'is_active' => true,
                'default_paper_size' => 'A4',
            ]
        );

        // 4. Default Printer
        Printer::firstOrCreate(
            ['branch_id' => $demoBranch->id, 'name' => 'Microsoft Print to PDF'],
            [
                'system_printer_name' => 'Microsoft Print to PDF',
                'model' => 'Virtual PDF Spooler',
                'capabilities' => ['color' => true, 'duplex' => true, 'paper_sizes' => ['A4', 'A3']],
                'is_default' => true,
                'is_active' => true,
                'status' => 'online',
            ]
        );

        // 5. Default Pricing Rules
        PricingRule::firstOrCreate(
            ['branch_id' => $demoBranch->id, 'paper_size' => 'A4'],
            [
                'bw_single_price' => 2.00,
                'bw_duplex_price' => 3.00,
                'color_single_price' => 10.00,
                'color_duplex_price' => 18.00,
                'duplex_pricing_mode' => 'per_side',
                'min_order_amount' => 2.00,
                'tax_rate_percent' => 0.00,
                'is_active' => true,
            ]
        );

        // 6. Default QR Code
        QrCode::firstOrCreate(
            ['token' => 'default'],
            [
                'branch_id' => $demoBranch->id,
                'label' => 'Main Counter QR',
                'is_active' => true,
            ]
        );

        // 7. Desktop Device with Master Code 'PRNT-8821-X9'
        DesktopDevice::firstOrCreate(
            ['pairing_code' => 'PRNT-8821-X9'],
            [
                'branch_id' => $demoBranch->id,
                'device_name' => 'Front Desk Counter PC',
                'device_uuid' => 'win-agent-test',
                'pairing_code_expires_at' => now()->addYears(2),
                'status' => 'standby',
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
