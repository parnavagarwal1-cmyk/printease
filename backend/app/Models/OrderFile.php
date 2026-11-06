<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderFile extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'original_filename',
        'storage_path',
        'file_hash_sha256',
        'mime_type',
        'page_count',
        'file_size_bytes',
        'expires_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'page_count' => 'integer',
        'file_size_bytes' => 'integer',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}
