<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Book extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'barcode',
        'isbn10',
        'isbn13',
        'title',
        'author',
        'publisher',
        'description',
        'cover_url',
        'published_at',
        'status',
        'location',
        'notes',
        'source',
    ];

    /**
     * @return BelongsTo<User, Book>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
