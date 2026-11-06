<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\DesktopDevice;
use App\Models\Printer;
use App\Models\Shop;
use App\Models\User;
use Tests\TestCase;

class DesktopPairingTest extends TestCase
{
    public function test_desktop_device_can_pair_with_valid_code_and_cannot_reuse_code(): void
    {
        $owner = User::factory()->create(['role' => 'shop_owner']);
        $shop = Shop::create([
            'name' => 'Print Station',
            'slug' => 'print-station',
            'contact_email' => 'station@test.com',
            'owner_id' => $owner->id,
        ]);
        $branch = Branch::create([
            'shop_id' => $shop->id,
            'name' => 'Station Branch',
        ]);

        $printer = Printer::create([
            'branch_id' => $branch->id,
            'name' => 'DeskJet 2130',
            'system_printer_name' => 'HP DeskJet 2130 series',
            'is_default' => true,
            'status' => 'online',
        ]);

        $ownerToken = $owner->createToken('owner-token')->plainTextToken;

        // 1. Owner generates pairing code
        $codeResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $ownerToken,
        ])->postJson("/api/branches/{$branch->id}/pairing-code", [
            'device_name' => 'Cash Counter PC',
        ]);

        $codeResponse->assertStatus(200);
        $pairingCode = $codeResponse->json('pairing_code');
        $this->assertNotEmpty($pairingCode);

        // 2. Desktop app sends pair request
        $pairResponse = $this->postJson('/api/desktop/pair', [
            'pairing_code' => $pairingCode,
            'device_name' => 'Windows 11 Counter PC',
            'device_uuid' => 'win-client-uuid-999',
            'os_info' => 'Windows 11 Pro 23H2',
            'app_version' => '1.0.0',
        ]);

        $pairResponse->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'device_token',
                'device' => ['id', 'name', 'uuid', 'status'],
                'branch' => ['id', 'name', 'shop_name'],
            ]);

        $deviceToken = $pairResponse->json('device_token');
        $this->assertNotEmpty($deviceToken);

        // 3. Pairing code must now be invalidated (one-time use)
        $reuseResponse = $this->postJson('/api/desktop/pair', [
            'pairing_code' => $pairingCode,
            'device_name' => 'Imposter PC',
            'device_uuid' => 'fake-uuid',
        ]);

        $reuseResponse->assertStatus(422);

        // 4. Device sends heartbeat using device token
        $heartbeatResponse = $this->withHeaders([
            'X-Device-Token' => $deviceToken,
        ])->postJson('/api/desktop/heartbeat', [
            'status' => 'online',
        ]);

        $heartbeatResponse->assertStatus(200)
            ->assertJsonPath('status', 'ok');

        // 5. Device fetches printers for branch
        $printersResponse = $this->withHeaders([
            'X-Device-Token' => $deviceToken,
        ])->getJson('/api/desktop/printers');

        $printersResponse->assertStatus(200)
            ->assertJsonCount(1, 'printers')
            ->assertJsonPath('printers.0.name', 'DeskJet 2130');
    }
}
