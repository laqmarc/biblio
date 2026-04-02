<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Services\BookMetadataService;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BookController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $user = $request->user();

        $books = Book::query()
            ->where('user_id', $user?->id)
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($builder) use ($search): void {
                    $builder
                        ->where('title', 'like', "%{$search}%")
                        ->orWhere('author', 'like', "%{$search}%")
                        ->orWhere('publisher', 'like', "%{$search}%")
                        ->orWhere('location', 'like', "%{$search}%");
                });
            })
            ->latest()
            ->get();

        return response()->json([
            'data' => $books,
        ]);
    }

    public function store(Request $request, BookMetadataService $metadataService): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
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

        $normalizedIdentifiers = $this->resolveIdentifiers($validated, $metadataService);
        $payload = array_merge($validated, $normalizedIdentifiers);
        $payload['user_id'] = $user?->id;
        $payload['status'] = $payload['status'] ?? 'pending';
        $payload['source'] = $payload['source'] ?? 'manual';

        $book = $this->upsertBook($user?->id, $payload);

        return response()->json([
            'data' => $book->fresh(),
        ], 201);
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
}
