<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('books', function (Blueprint $table): void {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->dropUnique('books_isbn10_unique');
            $table->dropUnique('books_isbn13_unique');
            $table->unique(['user_id', 'isbn10']);
            $table->unique(['user_id', 'isbn13']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('books', function (Blueprint $table): void {
            $table->dropUnique(['user_id', 'isbn10']);
            $table->dropUnique(['user_id', 'isbn13']);
            $table->dropConstrainedForeignId('user_id');
            $table->unique('isbn10');
            $table->unique('isbn13');
        });
    }
};
