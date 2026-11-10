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
        'purged_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'purged_at' => 'datetime',
        'page_count' => 'integer',
        'file_size_bytes' => 'integer',
    ];

    /**
     * Purge this individual file from cloud storage.
     */
    public function purge(): bool
    {
        if ($this->storage_path && $this->storage_path !== '[PURGED]') {
            if (\Illuminate\Support\Facades\Storage::disk('local')->exists($this->storage_path)) {
                \Illuminate\Support\Facades\Storage::disk('local')->delete($this->storage_path);
            }
            return (bool) $this->update([
                'storage_path' => '[PURGED]',
                'purged_at' => now(),
            ]);
        }
        return true;
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }
}
