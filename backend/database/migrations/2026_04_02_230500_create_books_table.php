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
        Schema::create('books', function (Blueprint $table): void {
            $table->id();
            $table->string('barcode', 32)->nullable();
            $table->string('isbn10', 10)->nullable()->unique();
            $table->string('isbn13', 13)->nullable()->unique();
            $table->string('title');
            $table->string('author')->nullable();
            $table->string('publisher')->nullable();
            $table->text('description')->nullable();
            $table->string('cover_url', 2048)->nullable();
            $table->string('published_at', 40)->nullable();
            $table->string('status', 20)->default('pending');
            $table->string('location', 100)->nullable();
            $table->text('notes')->nullable();
            $table->string('source', 50)->default('manual');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('books');
    }
};
