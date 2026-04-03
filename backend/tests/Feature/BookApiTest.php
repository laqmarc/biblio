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
            ->assertJsonPath('data.0.title', 'El nombre del viento')
            ->assertJsonPath('meta.total', 1);
    }

    public function test_it_filters_and_sorts_the_library_catalogue(): void
    {
        $user = User::factory()->create();

        Book::create([
            'user_id' => $user->id,
            'title' => 'Hyperion',
            'author' => 'Dan Simmons',
            'publisher' => 'Nova',
            'published_at' => '1989',
            'published_year' => 1989,
            'status' => 'read',
            'location' => 'Estudi',
            'notes' => 'Edicio tapa dura',
        ]);

        Book::create([
            'user_id' => $user->id,
            'title' => 'Dune',
            'author' => 'Frank Herbert',
            'publisher' => 'Debolsillo',
            'published_at' => '1965',
            'published_year' => 1965,
            'status' => 'pending',
            'location' => 'Menjador',
        ]);

        Book::create([
            'user_id' => $user->id,
            'title' => 'Dune Messiah',
            'author' => 'Frank Herbert',
            'publisher' => 'Debolsillo',
            'published_at' => '1969',
            'published_year' => 1969,
            'status' => 'read',
            'location' => 'Menjador',
        ]);

        $response = $this->actingAs($user)->getJson('/api/books?search=Dune&publisher=Debolsillo&location=Menjador&status=read&year=1969&sort=title&direction=asc&per_page=12');

        $response
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Dune Messiah')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.filters.publisher', 'Debolsillo')
            ->assertJsonPath('meta.filters.location', 'Menjador')
            ->assertJsonPath('meta.filters.status', 'read')
            ->assertJsonPath('meta.filters.year', 1969)
            ->assertJsonPath('meta.options.publishers.0', 'Debolsillo')
            ->assertJsonPath('meta.options.years.0', 1989);
    }

    public function test_it_updates_an_existing_book_for_the_authenticated_user(): void
    {
        $user = User::factory()->create();
        $book = Book::create([
            'user_id' => $user->id,
            'title' => 'Dune',
            'author' => 'Frank Herbert',
            'publisher' => 'Ace',
            'published_at' => '1965',
            'published_year' => 1965,
            'status' => 'pending',
            'location' => 'Menjador',
            'notes' => 'Primera ubicacio',
        ]);

        $response = $this->actingAs($user)->patchJson("/api/books/{$book->id}", [
            'title' => 'Dune',
            'author' => 'Frank Herbert',
            'publisher' => 'Debolsillo',
            'published_at' => '1965',
            'status' => 'read',
            'location' => 'Estudi',
            'notes' => 'Canviat de lloc',
            'source' => 'manual',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.id', $book->id)
            ->assertJsonPath('data.publisher', 'Debolsillo')
            ->assertJsonPath('data.status', 'read')
            ->assertJsonPath('data.location', 'Estudi')
            ->assertJsonPath('data.notes', 'Canviat de lloc');

        $this->assertDatabaseHas('books', [
            'id' => $book->id,
            'publisher' => 'Debolsillo',
            'status' => 'read',
            'location' => 'Estudi',
            'notes' => 'Canviat de lloc',
        ]);
    }

    public function test_it_cannot_update_a_book_owned_by_another_user(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $book = Book::create([
            'user_id' => $otherUser->id,
            'title' => 'Dune',
        ]);

        $this->actingAs($user)
            ->patchJson("/api/books/{$book->id}", [
                'title' => 'Dune Messiah',
            ])
            ->assertNotFound();
    }

    public function test_it_deletes_an_existing_book_for_the_authenticated_user(): void
    {
        $user = User::factory()->create();
        $book = Book::create([
            'user_id' => $user->id,
            'title' => 'Dune',
        ]);

        $this->actingAs($user)
            ->deleteJson("/api/books/{$book->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Llibre eliminat correctament.');

        $this->assertDatabaseMissing('books', [
            'id' => $book->id,
        ]);
    }

    public function test_it_cannot_delete_a_book_owned_by_another_user(): void
    {
        $user = User::factory()->create();
        $otherUser = User::factory()->create();
        $book = Book::create([
            'user_id' => $otherUser->id,
            'title' => 'Dune',
        ]);

        $this->actingAs($user)
            ->deleteJson("/api/books/{$book->id}")
            ->assertNotFound();
    }
}
