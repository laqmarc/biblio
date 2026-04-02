<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class BookApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['cache.default' => 'array']);
    }

    public function test_it_looks_up_a_book_by_barcode(): void
    {
        Http::fake([
            'https://openlibrary.org/*' => Http::response([
                'ISBN:9788499890944' => [
                    'title' => 'El nombre del viento',
                    'subtitle' => 'Cronica del asesino de reyes',
                    'authors' => [
                        ['name' => 'Patrick Rothfuss'],
                    ],
                    'publishers' => [
                        ['name' => 'Debolsillo'],
                    ],
                    'cover' => [
                        'large' => 'https://covers.openlibrary.org/b/id/12345-L.jpg',
                    ],
                    'publish_date' => '2011',
                ],
            ], 200),
            'https://www.googleapis.com/*' => Http::response([
                'items' => [
                    [
                        'volumeInfo' => [
                            'description' => 'Primera part de la historia de Kvothe.',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->getJson('/api/books/lookup?barcode=9788499890944');

        $response
            ->assertOk()
            ->assertJsonPath('data.isbn13', '9788499890944')
            ->assertJsonPath('data.title', 'El nombre del viento: Cronica del asesino de reyes')
            ->assertJsonPath('data.author', 'Patrick Rothfuss')
            ->assertJsonPath('data.publisher', 'Debolsillo')
            ->assertJsonPath('data.description', 'Primera part de la historia de Kvothe.');
    }

    public function test_it_requires_authentication_to_store_and_list_books(): void
    {
        $this->getJson('/api/books')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Cal iniciar sessio.');

        $this->postJson('/api/books', [
            'title' => 'Dune',
        ])->assertUnauthorized();
    }

    public function test_it_stores_and_lists_only_the_authenticated_users_books(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();

        $payload = [
            'barcode' => '9788499890944',
            'title' => 'El nombre del viento',
            'author' => 'Patrick Rothfuss',
            'publisher' => 'Debolsillo',
            'status' => 'read',
            'location' => 'Menjador',
            'notes' => 'Edicio butxaca',
        ];

        $storeResponse = $this->actingAs($user)->postJson('/api/books', $payload);

        $storeResponse
            ->assertCreated()
            ->assertJsonPath('data.isbn13', '9788499890944')
            ->assertJsonPath('data.status', 'read')
            ->assertJsonPath('data.user_id', $user->id);

        $this->assertDatabaseHas('books', [
            'user_id' => $user->id,
            'isbn13' => '9788499890944',
            'title' => 'El nombre del viento',
        ]);

        Book::create([
            'user_id' => $user->id,
            'title' => 'Dune',
            'author' => 'Frank Herbert',
            'status' => 'pending',
        ]);

        Book::create([
            'user_id' => $otherUser->id,
            'title' => 'Patrick Melrose',
            'author' => 'Edward St Aubyn',
            'status' => 'read',
        ]);

        $indexResponse = $this->actingAs($user)->getJson('/api/books?search=Patrick');

        $indexResponse
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'El nombre del viento');
    }
}
