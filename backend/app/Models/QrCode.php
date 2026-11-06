<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class QrCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'token',
        'label',
        'is_active',
        'scan_count',
        'last_scanned_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_scanned_at' => 'datetime',
    ];

    public static function generateToken(): string
    {
        do {
            $token = 'pe_' . Str::random(32);
        } while (static::where('token', $token)->exists());

        return $token;
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }
}
