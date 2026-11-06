<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_shop_owner_can_register_and_receive_token_and_initial_shop(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Aditi Rao',
            'email' => 'aditi@delhiprint.com',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
            'phone' => '+919811223344',
            'shop_name' => 'Delhi Print Hub',
            'branch_name' => 'Karol Bagh Branch',
            'city' => 'New Delhi',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'token',
                'user' => ['id', 'name', 'email', 'role'],
                'shop' => ['id', 'name', 'slug'],
            ]);

        $this->assertDatabaseHas('users', ['email' => 'aditi@delhiprint.com', 'role' => 'shop_owner']);
        $this->assertDatabaseHas('shops', ['name' => 'Delhi Print Hub']);
        $this->assertDatabaseHas('branches', ['name' => 'Karol Bagh Branch']);
        $this->assertDatabaseHas('pricing_rules', ['paper_size' => 'A4']);
        $this->assertDatabaseHas('qr_codes', ['label' => 'Main Counter QR']);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'login-test@example.com',
            'password' => bcrypt('Secret1234!'),
            'role' => 'shop_owner',
            'is_active' => true,
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'login-test@example.com',
            'password' => 'Secret1234!',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'token',
                'user' => ['id', 'name', 'email', 'role'],
                'shops',
            ]);
    }

    public function test_login_fails_with_invalid_password(): void
    {
        User::factory()->create([
            'email' => 'wrong-pass@example.com',
            'password' => bcrypt('CorrectPassword1!'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'wrong-pass@example.com',
            'password' => 'WrongPassword',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(401);
    }

    public function test_authenticated_user_can_access_me_and_logout(): void
    {
        $user = User::factory()->create([
            'role' => 'shop_owner',
        ]);

        $token = $user->createToken('test-token')->plainTextToken;

        $meResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->getJson('/api/auth/me');

        $meResponse->assertStatus(200)
            ->assertJsonPath('user.email', $user->email);

        $logoutResponse = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson('/api/auth/logout');

        $logoutResponse->assertStatus(200)
            ->assertJsonPath('message', 'Logged out successfully');

        // Verify token deleted from database
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $user->id,
        ]);
    }
}
