<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_registers_a_user_and_returns_a_token(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Marta',
            'email' => 'marta@example.com',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.user.email', 'marta@example.com');

        $this->assertDatabaseHas('users', [
            'email' => 'marta@example.com',
        ]);
        $this->assertDatabaseCount('api_tokens', 1);
    }

    public function test_it_logs_in_and_returns_the_authenticated_user(): void
    {
        $user = User::factory()->create([
            'email' => 'anna@example.com',
            'password' => 'secret123',
        ]);

        $loginResponse = $this->postJson('/api/auth/login', [
            'email' => 'anna@example.com',
            'password' => 'secret123',
        ]);

        $token = (string) $loginResponse->json('data.token');

        $loginResponse
            ->assertOk()
            ->assertJsonPath('data.user.id', $user->id);

        $this->getJson('/api/auth/me', [
            'Authorization' => "Bearer {$token}",
        ])->assertOk()
            ->assertJsonPath('data.user.email', 'anna@example.com');
    }
}
