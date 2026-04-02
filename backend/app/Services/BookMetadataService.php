<?php

namespace App\Services;

use App\Models\Book;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BookMetadataService
{
    public function normalizeBarcode(string $barcode): ?array
    {
        $normalized = Str::upper(preg_replace('/[^0-9X]/', '', $barcode) ?? '');

        if ($normalized === '') {
            return null;
        }

        if (strlen($normalized) === 13 && ctype_digit($normalized) && $this->isValidIsbn13($normalized)) {
            return [
                'barcode' => $normalized,
                'isbn10' => $this->isbn13ToIsbn10($normalized),
                'isbn13' => $normalized,
            ];
        }

        if (strlen($normalized) === 10 && $this->isValidIsbn10($normalized)) {
            return [
                'barcode' => $normalized,
                'isbn10' => $normalized,
                'isbn13' => $this->isbn10ToIsbn13($normalized),
            ];
        }

        return null;
    }

    public function lookupByIdentifiers(array $identifiers): ?array
    {
        $localBook = $this->findLocalBook($identifiers);
        $remoteBook = Cache::remember(
            $this->cacheKey($identifiers),
            now()->addDays(30),
            fn (): array => $this->lookupRemoteBook($identifiers),
        );

        $merged = $this->mergeBookData($identifiers, $localBook?->toArray() ?? [], $remoteBook);

        return filled($merged['title']) ? $merged : null;
    }

    private function findLocalBook(array $identifiers): ?Book
    {
        $query = Book::query();

        $query->where(function ($builder) use ($identifiers): void {
            if (! empty($identifiers['isbn13'])) {
                $builder->orWhere('isbn13', $identifiers['isbn13']);
            }

            if (! empty($identifiers['isbn10'])) {
                $builder->orWhere('isbn10', $identifiers['isbn10']);
            }
        });

        return $query->latest('updated_at')->first();
    }

    private function lookupRemoteBook(array $identifiers): array
    {
        $openLibrary = $this->lookupOpenLibrary($identifiers);
        $googleBooks = $this->lookupGoogleBooks($identifiers);

        return [
            'barcode' => $identifiers['barcode'] ?? null,
            'isbn10' => $identifiers['isbn10'] ?? ($openLibrary['isbn10'] ?? $googleBooks['isbn10'] ?? null),
            'isbn13' => $identifiers['isbn13'] ?? ($openLibrary['isbn13'] ?? $googleBooks['isbn13'] ?? null),
            'title' => $this->firstFilled($openLibrary['title'] ?? null, $googleBooks['title'] ?? null),
            'author' => $this->firstFilled($openLibrary['author'] ?? null, $googleBooks['author'] ?? null),
            'publisher' => $this->firstFilled($openLibrary['publisher'] ?? null, $googleBooks['publisher'] ?? null),
            'description' => $this->firstFilled($googleBooks['description'] ?? null, $openLibrary['description'] ?? null),
            'cover_url' => $this->firstFilled($openLibrary['cover_url'] ?? null, $googleBooks['cover_url'] ?? null),
            'published_at' => $this->firstFilled($openLibrary['published_at'] ?? null, $googleBooks['published_at'] ?? null),
            'source' => $this->firstFilled($openLibrary['source'] ?? null, $googleBooks['source'] ?? null),
        ];
    }

    private function lookupOpenLibrary(array $identifiers): array
    {
        foreach (array_filter([$identifiers['isbn13'] ?? null, $identifiers['isbn10'] ?? null]) as $isbn) {
            try {
                $response = Http::acceptJson()
                    ->retry(2, 250, throw: false)
                    ->timeout(10)
                    ->get('https://openlibrary.org/api/books', [
                        'bibkeys' => "ISBN:{$isbn}",
                        'format' => 'json',
                        'jscmd' => 'data',
                    ]);
            } catch (\Throwable $exception) {
                Log::warning('Open Library lookup failed', [
                    'isbn' => $isbn,
                    'message' => $exception->getMessage(),
                ]);

                continue;
            }

            if (! $response->successful()) {
                continue;
            }

            $item = $response->json("ISBN:{$isbn}");

            if (! is_array($item) || $item === []) {
                continue;
            }

            return [
                'title' => $this->buildTitle($item['title'] ?? null, $item['subtitle'] ?? null),
                'author' => $this->joinNames($item['authors'] ?? []),
                'publisher' => $this->joinNames($item['publishers'] ?? []),
                'description' => $this->cleanText($item['notes'] ?? null),
                'cover_url' => $this->normalizeCoverUrl(
                    Arr::get($item, 'cover.large')
                    ?? Arr::get($item, 'cover.medium')
                    ?? Arr::get($item, 'cover.small')
                ),
                'published_at' => $item['publish_date'] ?? null,
                'source' => 'open_library',
            ];
        }

        return [];
    }

    private function lookupGoogleBooks(array $identifiers): array
    {
        foreach (array_filter([$identifiers['isbn13'] ?? null, $identifiers['isbn10'] ?? null]) as $isbn) {
            try {
                $response = Http::acceptJson()
                    ->retry(2, 250, throw: false)
                    ->timeout(10)
                    ->get('https://www.googleapis.com/books/v1/volumes', array_filter([
                        'q' => "isbn:{$isbn}",
                        'maxResults' => 1,
                        'key' => config('services.google_books.key'),
                    ]));
            } catch (\Throwable $exception) {
                Log::warning('Google Books lookup failed', [
                    'isbn' => $isbn,
                    'message' => $exception->getMessage(),
                ]);

                continue;
            }

            if (! $response->successful()) {
                Log::info('Google Books lookup returned non-success status', [
                    'isbn' => $isbn,
                    'status' => $response->status(),
                ]);

                continue;
            }

            $item = Arr::get($response->json(), 'items.0.volumeInfo');

            if (! is_array($item)) {
                continue;
            }

            return [
                'title' => $this->buildTitle($item['title'] ?? null, $item['subtitle'] ?? null),
                'author' => collect($item['authors'] ?? [])->filter()->implode(', '),
                'publisher' => $item['publisher'] ?? null,
                'description' => $this->cleanText($item['description'] ?? null),
                'cover_url' => $this->normalizeCoverUrl(
                    Arr::get($item, 'imageLinks.thumbnail')
                    ?? Arr::get($item, 'imageLinks.smallThumbnail')
                ),
                'published_at' => $item['publishedDate'] ?? null,
                'source' => 'google_books',
            ];
        }

        return [];
    }

    private function mergeBookData(array $identifiers, array $localBook, array $remoteBook): array
    {
        return [
            'barcode' => $identifiers['barcode'] ?? ($localBook['barcode'] ?? $remoteBook['barcode'] ?? null),
            'isbn10' => $identifiers['isbn10'] ?? ($localBook['isbn10'] ?? $remoteBook['isbn10'] ?? null),
            'isbn13' => $identifiers['isbn13'] ?? ($localBook['isbn13'] ?? $remoteBook['isbn13'] ?? null),
            'title' => $this->firstFilled($localBook['title'] ?? null, $remoteBook['title'] ?? null),
            'author' => $this->firstFilled($localBook['author'] ?? null, $remoteBook['author'] ?? null),
            'publisher' => $this->firstFilled($localBook['publisher'] ?? null, $remoteBook['publisher'] ?? null),
            'description' => $this->firstFilled($localBook['description'] ?? null, $remoteBook['description'] ?? null),
            'cover_url' => $this->firstFilled($localBook['cover_url'] ?? null, $remoteBook['cover_url'] ?? null),
            'published_at' => $this->firstFilled($localBook['published_at'] ?? null, $remoteBook['published_at'] ?? null),
            'status' => $localBook['status'] ?? 'pending',
            'location' => $localBook['location'] ?? null,
            'notes' => $localBook['notes'] ?? null,
            'source' => $this->firstFilled($localBook['source'] ?? null, $remoteBook['source'] ?? null, 'manual'),
        ];
    }

    private function cacheKey(array $identifiers): string
    {
        return 'book_lookup:'.($identifiers['isbn13'] ?? $identifiers['isbn10'] ?? $identifiers['barcode']);
    }

    private function firstFilled(?string ...$values): ?string
    {
        foreach ($values as $value) {
            if (filled($value)) {
                return $value;
            }
        }

        return null;
    }

    private function buildTitle(?string $title, ?string $subtitle): ?string
    {
        $title = $this->cleanText($title);
        $subtitle = $this->cleanText($subtitle);

        if (! $title) {
            return null;
        }

        return $subtitle ? "{$title}: {$subtitle}" : $title;
    }

    private function joinNames(array $items): ?string
    {
        $names = collect($items)
            ->map(fn ($item) => is_array($item) ? ($item['name'] ?? null) : null)
            ->filter()
            ->implode(', ');

        return $names !== '' ? $names : null;
    }

    private function cleanText(mixed $value): ?string
    {
        if (is_array($value)) {
            $value = $value['value'] ?? null;
        }

        if (! is_string($value)) {
            return null;
        }

        $cleaned = trim(preg_replace('/\s+/', ' ', strip_tags($value)) ?? '');

        return $cleaned !== '' ? $cleaned : null;
    }

    private function normalizeCoverUrl(?string $url): ?string
    {
        if (! filled($url)) {
            return null;
        }

        return Str::replaceFirst('http://', 'https://', $url);
    }

    private function isValidIsbn10(string $isbn10): bool
    {
        if (! preg_match('/^\d{9}[\dX]$/', $isbn10)) {
            return false;
        }

        $sum = 0;

        foreach (str_split($isbn10) as $index => $character) {
            $value = $character === 'X' ? 10 : (int) $character;
            $sum += $value * (10 - $index);
        }

        return $sum % 11 === 0;
    }

    private function isValidIsbn13(string $isbn13): bool
    {
        if (! preg_match('/^\d{13}$/', $isbn13)) {
            return false;
        }

        $sum = 0;

        foreach (str_split(substr($isbn13, 0, 12)) as $index => $character) {
            $sum += (int) $character * ($index % 2 === 0 ? 1 : 3);
        }

        $checkDigit = (10 - ($sum % 10)) % 10;

        return $checkDigit === (int) substr($isbn13, -1);
    }

    private function isbn10ToIsbn13(string $isbn10): string
    {
        $body = '978'.substr($isbn10, 0, 9);
        $sum = 0;

        foreach (str_split($body) as $index => $character) {
            $sum += (int) $character * ($index % 2 === 0 ? 1 : 3);
        }

        $checkDigit = (10 - ($sum % 10)) % 10;

        return $body.$checkDigit;
    }

    private function isbn13ToIsbn10(string $isbn13): ?string
    {
        if (! Str::startsWith($isbn13, '978')) {
            return null;
        }

        $body = substr($isbn13, 3, 9);
        $sum = 0;

        foreach (str_split($body) as $index => $character) {
            $sum += (int) $character * (10 - $index);
        }

        $remainder = 11 - ($sum % 11);
        $checkDigit = match ($remainder) {
            10 => 'X',
            11 => '0',
            default => (string) $remainder,
        };

        return $body.$checkDigit;
    }
}
