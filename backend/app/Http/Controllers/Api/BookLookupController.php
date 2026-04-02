<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BookMetadataService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookLookupController extends Controller
{
    public function __invoke(Request $request, BookMetadataService $metadataService): JsonResponse
    {
        $validated = $request->validate([
            'barcode' => ['required', 'string', 'max:32'],
        ]);

        $identifiers = $metadataService->normalizeBarcode($validated['barcode']);

        if (! $identifiers) {
            return response()->json([
                'message' => 'El codi escanejat no sembla un ISBN vàlid.',
            ], 422);
        }

        $book = $metadataService->lookupByIdentifiers($identifiers);

        if (! $book) {
            return response()->json([
                'message' => 'No hem trobat cap llibre per aquest codi.',
            ], 404);
        }

        return response()->json([
            'data' => $book,
        ]);
    }
}
