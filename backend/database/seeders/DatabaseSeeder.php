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
        $superAdmin = User::firstOrCreate(
            ['email' => 'superadmin@printease.com'],
            [
                'name' => 'PrintEase Master Admin',
                'password' => Hash::make('Password123!'),
                'phone' => '+919999900000',
                'role' => 'super_admin',
                'is_active' => true,
            ]
        );

        // 3. Demo Shop Owner
        $shopOwner = User::firstOrCreate(
            ['email' => 'owner@metroprint.com'],
            [
                'name' => 'Vikram Sharma',
                'password' => Hash::make('Password123!'),
                'phone' => '+919876543210',
                'role' => 'shop_owner',
                'is_active' => true,
            ]
        );

        // 4. Demo Shop
        $shop = Shop::firstOrCreate(
            ['slug' => 'metro-print-solutions'],
            [
                'name' => 'Metro Print Solutions',
                'contact_email' => 'contact@metroprint.com',
                'contact_phone' => '+919876543210',
                'gst_number' => '07AAAAA0000A1Z5',
                'status' => 'active',
                'owner_id' => $shopOwner->id,
            ]
        );

        // Member entry
        ShopMember::firstOrCreate(
            ['shop_id' => $shop->id, 'user_id' => $shopOwner->id],
            ['role' => 'shop_owner']
        );

        // Active subscription
        Subscription::firstOrCreate(
            ['shop_id' => $shop->id, 'plan_id' => $proPlan->id],
            [
                'status' => 'active',
                'starts_at' => now(),
                'ends_at' => now()->addMonth(),
            ]
        );

        // 5. Default Branch
        $branch = Branch::firstOrCreate(
            ['shop_id' => $shop->id, 'code' => 'MAIN'],
            [
                'name' => 'Connaught Place Main Branch',
                'address' => 'Shop 14, Inner Circle, Connaught Place',
                'city' => 'New Delhi',
                'state' => 'Delhi',
                'pincode' => '110001',
                'phone' => '+919876543210',
                'is_active' => true,
            ]
        );

        // 6. Printers for Branch
        $laserPrinter = Printer::firstOrCreate(
            ['branch_id' => $branch->id, 'name' => 'LaserJet Heavy Duty (Counter 1)'],
            [
                'system_printer_name' => 'HP LaserJet Pro MFP M126nw',
                'model' => 'HP LaserJet Pro MFP M126nw',
                'capabilities' => [
                    'color' => false,
                    'duplex' => true,
                    'paper_sizes' => ['A4', 'Legal', 'Letter'],
                ],
                'is_default' => true,
                'status' => 'online',
                'is_active' => true,
            ]
        );

        Printer::firstOrCreate(
            ['branch_id' => $branch->id, 'name' => 'Color Master InkJet (Counter 2)'],
            [
                'system_printer_name' => 'Canon PIXMA G3000 Series',
                'model' => 'Canon PIXMA G3000',
                'capabilities' => [
                    'color' => true,
                    'duplex' => false,
                    'paper_sizes' => ['A4', 'A3', 'Photo 4x6'],
                ],
                'is_default' => false,
                'status' => 'online',
                'is_active' => true,
            ]
        );

        // 7. Pricing Rules for Branch
        PricingRule::firstOrCreate(
            ['branch_id' => $branch->id, 'paper_size' => 'A4'],
            [
                'bw_single_price' => 2.00,
                'bw_duplex_price' => 3.00,
                'color_single_price' => 10.00,
                'color_duplex_price' => 18.00,
                'duplex_pricing_mode' => 'per_side',
                'min_order_amount' => 5.00,
                'tax_rate_percent' => 18.00,
                'is_active' => true,
            ]
        );

        PricingRule::firstOrCreate(
            ['branch_id' => $branch->id, 'paper_size' => 'A3'],
            [
                'bw_single_price' => 5.00,
                'bw_duplex_price' => 8.00,
                'color_single_price' => 25.00,
                'color_duplex_price' => 45.00,
                'duplex_pricing_mode' => 'per_side',
                'min_order_amount' => 10.00,
                'tax_rate_percent' => 18.00,
                'is_active' => true,
            ]
        );

        // 8. Public QR Token for Branch
        $qr = QrCode::firstOrCreate(
            ['branch_id' => $branch->id, 'label' => 'Main Front Counter QR'],
            [
                'token' => 'pe_demo_connaught_branch_token_99',
                'is_active' => true,
                'scan_count' => 0,
            ]
        );

        // 9. Active Pairing Code for Desktop Device
        DesktopDevice::firstOrCreate(
            ['device_uuid' => 'demo-pc-uuid-windows-11-001'],
            [
                'branch_id' => $branch->id,
                'device_name' => 'Front Desk Counter PC 1',
                'pairing_code' => 'PRNT-8821-X9',
                'pairing_code_expires_at' => now()->addDays(7),
                'selected_printer_id' => $laserPrinter->id,
                'app_version' => '1.0.0',
                'os_info' => 'Windows 10/11 Pro (x64)',
                'status' => 'standby',
            ]
        );

        AuditLog::create([
            'user_id' => $superAdmin->id,
            'shop_id' => $shop->id,
            'action' => 'seed_initialized',
            'entity_type' => 'system',
            'entity_id' => $shop->id,
            'ip_address' => '127.0.0.1',
            'details' => ['message' => 'Initial seed data populated successfully'],
        ]);
    }
}
