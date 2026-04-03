<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('books', function (Blueprint $table): void {
            $table->unsignedSmallInteger('published_year')->nullable()->after('published_at');
            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'location']);
            $table->index(['user_id', 'publisher']);
            $table->index(['user_id', 'published_year']);
        });

        DB::table('books')
            ->select(['id', 'published_at'])
            ->orderBy('id')
            ->chunkById(100, function ($books): void {
                foreach ($books as $book) {
                    $year = $this->extractPublishedYear($book->published_at);

                    if ($year === null) {
                        continue;
                    }

                    DB::table('books')
                        ->where('id', $book->id)
                        ->update(['published_year' => $year]);
                }
            });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('books', function (Blueprint $table): void {
            $table->dropIndex(['user_id', 'status']);
            $table->dropIndex(['user_id', 'location']);
            $table->dropIndex(['user_id', 'publisher']);
            $table->dropIndex(['user_id', 'published_year']);
            $table->dropColumn('published_year');
        });
    }

    private function extractPublishedYear(?string $publishedAt): ?int
    {
        if (! is_string($publishedAt)) {
            return null;
        }

        if (! preg_match('/\b(1[5-9]\d{2}|20\d{2}|2100)\b/', $publishedAt, $matches)) {
            return null;
        }

        return (int) $matches[1];
    }
};
