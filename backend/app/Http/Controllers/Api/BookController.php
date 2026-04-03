<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Services\BookMetadataService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BookController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['pending', 'reading', 'read', 'loaned'])],
            'location' => ['nullable', 'string', 'max:100'],
            'publisher' => ['nullable', 'string', 'max:255'],
            'year' => ['nullable', 'integer', 'between:1500,2100'],
            'sort' => ['nullable', Rule::in(['created_at', 'title', 'author', 'publisher', 'location', 'published_year', 'status'])],
            'direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'between:12,60'],
        ]);
        $user = $request->user();
        $search = trim((string) ($filters['search'] ?? ''));
        $status = $filters['status'] ?? null;
        $location = trim((string) ($filters['location'] ?? ''));
        $publisher = trim((string) ($filters['publisher'] ?? ''));
        $year = isset($filters['year']) ? (int) $filters['year'] : null;
        $sort = $filters['sort'] ?? 'created_at';
        $direction = $filters['direction'] ?? ($sort === 'created_at' ? 'desc' : 'asc');
        $perPage = (int) ($filters['per_page'] ?? 24);

        $baseQuery = Book::query()->where('user_id', $user?->id);
        $booksQuery = (clone $baseQuery);

        $this->applyLibraryFilters($booksQuery, [
            'search' => $search,
            'status' => $status,
            'location' => $location,
            'publisher' => $publisher,
            'year' => $year,
        ]);

        $this->applyLibrarySorting($booksQuery, $sort, $direction);

        $books = $booksQuery
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => $books->items(),
            'meta' => [
                'library_total' => (clone $baseQuery)->count(),
                'current_page' => $books->currentPage(),
                'last_page' => $books->lastPage(),
                'per_page' => $books->perPage(),
                'total' => $books->total(),
                'from' => $books->firstItem(),
                'to' => $books->lastItem(),
                'filters' => [
                    'search' => $search,
                    'status' => $status,
                    'location' => $location,
                    'publisher' => $publisher,
                    'year' => $year,
                    'sort' => $sort,
                    'direction' => $direction,
                ],
                'options' => [
                    'statuses' => [
                        ['value' => 'pending', 'label' => 'Per llegir'],
                        ['value' => 'reading', 'label' => 'Llegint'],
                        ['value' => 'read', 'label' => 'Llegit'],
                        ['value' => 'loaned', 'label' => 'Deixat'],
                    ],
                    'locations' => $this->distinctValues((clone $baseQuery), 'location'),
                    'publishers' => $this->distinctValues((clone $baseQuery), 'publisher'),
                    'years' => $this->distinctYears((clone $baseQuery)),
                ],
            ],
        ]);
    }

    public function store(Request $request, BookMetadataService $metadataService): JsonResponse
    {
        $user = $request->user();
        $validated = $this->validateBookPayload($request);

        $normalizedIdentifiers = $this->resolveIdentifiers($validated, $metadataService);
        $payload = array_merge($validated, $normalizedIdentifiers);
        $payload['user_id'] = $user?->id;
        $payload['status'] = $payload['status'] ?? 'pending';
        $payload['source'] = $payload['source'] ?? 'manual';
        $payload['published_year'] = $this->extractPublishedYear($payload['published_at'] ?? null);

        $book = $this->upsertBook($user?->id, $payload);

        return response()->json([
            'data' => $book->fresh(),
        ], 201);
    }

    public function update(Request $request, Book $book, BookMetadataService $metadataService): JsonResponse
    {
        $user = $request->user();

        abort_if($book->user_id !== $user?->id, 404);

        $validated = $this->validateBookPayload($request);
        $normalizedIdentifiers = $this->resolveIdentifiers($validated, $metadataService);
        $payload = array_merge($validated, $normalizedIdentifiers);
        $payload['published_year'] = $this->extractPublishedYear($payload['published_at'] ?? null);

        $book->fill($payload);
        $book->save();

        return response()->json([
            'data' => $book->fresh(),
        ]);
    }

    public function destroy(Request $request, Book $book): JsonResponse
    {
        $user = $request->user();

        abort_if($book->user_id !== $user?->id, 404);

        $book->delete();

        return response()->json([
            'message' => 'Llibre eliminat correctament.',
        ]);
    }

    private function resolveIdentifiers(array $validated, BookMetadataService $metadataService): array
    {
        $identifier = $validated['barcode'] ?? $validated['isbn13'] ?? $validated['isbn10'] ?? null;

        if (! $identifier) {
            return [];
        }

        $normalized = $metadataService->normalizeBarcode($identifier);

        if (! $normalized) {
            throw new HttpResponseException(response()->json([
                'message' => 'L ISBN o codi de barres no es valid.',
            ], 422));
        }

        return $normalized;
    }

    private function upsertBook(?int $userId, array $payload): Book
    {
        if (! empty($payload['isbn13'])) {
            return Book::updateOrCreate(
                ['user_id' => $userId, 'isbn13' => $payload['isbn13']],
                $payload,
            );
        }

        if (! empty($payload['isbn10'])) {
            return Book::updateOrCreate(
                ['user_id' => $userId, 'isbn10' => $payload['isbn10']],
                $payload,
            );
        }

        return Book::create($payload);
    }

    private function validateBookPayload(Request $request): array
    {
        return $request->validate([
            'barcode' => ['nullable', 'string', 'max:32'],
            'isbn10' => ['nullable', 'string', 'max:10'],
            'isbn13' => ['nullable', 'string', 'max:13'],
            'title' => ['required', 'string', 'max:255'],
            'author' => ['nullable', 'string', 'max:255'],
            'publisher' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'cover_url' => ['nullable', 'url', 'max:2048'],
            'published_at' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', Rule::in(['pending', 'reading', 'read', 'loaned'])],
            'location' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string'],
            'source' => ['nullable', 'string', 'max:50'],
        ]);
    }

    /**
     * @param  array{search:string,status:?string,location:string,publisher:string,year:?int}  $filters
     */
    private function applyLibraryFilters(Builder $query, array $filters): void
    {
        if ($filters['search'] !== '') {
            $search = $filters['search'];

            $query->where(function (Builder $builder) use ($search): void {
                $builder
                    ->where('title', 'like', "%{$search}%")
                    ->orWhere('author', 'like', "%{$search}%")
                    ->orWhere('publisher', 'like', "%{$search}%")
                    ->orWhere('location', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%")
                    ->orWhere('isbn10', 'like', "%{$search}%")
                    ->orWhere('isbn13', 'like', "%{$search}%")
                    ->orWhere('published_at', 'like', "%{$search}%");
            });
        }

        if ($filters['status'] !== null) {
            $query->where('status', $filters['status']);
        }

        if ($filters['location'] !== '') {
            $query->where('location', $filters['location']);
        }

        if ($filters['publisher'] !== '') {
            $query->where('publisher', $filters['publisher']);
        }

        if ($filters['year'] !== null) {
            $query->where('published_year', $filters['year']);
        }
    }

    private function applyLibrarySorting(Builder $query, string $sort, string $direction): void
    {
        $sortableColumns = [
            'created_at' => 'created_at',
            'title' => 'title',
            'author' => 'author',
            'publisher' => 'publisher',
            'location' => 'location',
            'published_year' => 'published_year',
            'status' => 'status',
        ];

        $column = $sortableColumns[$sort] ?? 'created_at';

        if ($column === 'published_year') {
            $query
                ->orderByRaw('published_year IS NULL')
                ->orderBy($column, $direction)
                ->orderBy('title');

            return;
        }

        $query
            ->orderByRaw("{$column} IS NULL")
            ->orderBy($column, $direction)
            ->orderBy('created_at', 'desc');
    }

    /**
     * @return list<string>
     */
    private function distinctValues(Builder $query, string $column): array
    {
        return $query
            ->whereNotNull($column)
            ->where($column, '!=', '')
            ->distinct()
            ->orderBy($column)
            ->pluck($column)
            ->all();
    }

    /**
     * @return list<int>
     */
    private function distinctYears(Builder $query): array
    {
        return $query
            ->whereNotNull('published_year')
            ->distinct()
            ->orderByDesc('published_year')
            ->pluck('published_year')
            ->map(fn (mixed $year): int => (int) $year)
            ->all();
    }

    private function extractPublishedYear(?string $publishedAt): ?int
    {
        if (! is_string($publishedAt) || ! preg_match('/\b(1[5-9]\d{2}|20\d{2}|2100)\b/', $publishedAt, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }
}
