<?php

namespace Tests\Feature;

use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_existing_user_can_sign_in_via_google(): void
    {
        $user = User::firstOrCreate(
            ['email' => 'parnavagarwal1@gmail.com'],
            [
                'name' => 'Pranav Agarwal',
                'password' => 'Secret@123',
                'role' => 'super_admin',
                'is_active' => true,
            ]
        );

        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'sub' => 'google_sub_1234567890',
                'email' => 'parnavagarwal1@gmail.com',
                'email_verified' => 'true',
                'name' => 'Pranav Agarwal',
                'picture' => 'https://lh3.googleusercontent.com/avatar.jpg',
            ], 200),
        ]);

        $response = $this->postJson('/api/auth/google', [
            'credential' => 'valid_google_jwt_token',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.email', 'parnavagarwal1@gmail.com')
            ->assertJsonPath('user.role', 'super_admin');

        $this->assertDatabaseHas('users', [
            'email' => 'parnavagarwal1@gmail.com',
            'google_id' => 'google_sub_1234567890',
        ]);
    }

    public function test_new_user_automatically_registers_shop_and_branch_via_google(): void
    {
        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'sub' => 'google_sub_987654321',
                'email' => 'newshopowner@gmail.com',
                'email_verified' => 'true',
                'name' => 'Aman Sharma',
                'picture' => 'https://lh3.googleusercontent.com/aman.jpg',
            ], 200),
        ]);

        $response = $this->postJson('/api/auth/google', [
            'credential' => 'new_user_google_jwt_token',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('user.email', 'newshopowner@gmail.com')
            ->assertJsonPath('user.role', 'shop_owner');

        $this->assertDatabaseHas('users', [
            'email' => 'newshopowner@gmail.com',
            'google_id' => 'google_sub_987654321',
            'role' => 'shop_owner',
        ]);

        // Default shop and branch should exist
        $this->assertDatabaseHas('shops', [
            'contact_email' => 'newshopowner@gmail.com',
        ]);
        $this->assertDatabaseHas('branches', [
            'name' => 'Main Counter',
        ]);
    }

    public function test_rejects_invalid_google_credential(): void
    {
        Http::fake([
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'error' => 'invalid_token',
                'error_description' => 'Invalid Value',
            ], 400),
        ]);

        $response = $this->postJson('/api/auth/google', [
            'credential' => 'fake_invalid_jwt_token',
        ]);

        $response->assertStatus(401);
    }
}
