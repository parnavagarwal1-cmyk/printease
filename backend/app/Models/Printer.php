<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Printer extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'name',
        'system_printer_name',
        'model',
        'capabilities',
        'is_default',
        'status',
        'is_active',
    ];

    protected $casts = [
        'capabilities' => 'array',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    protected $appends = [
        'supports_color',
        'supports_duplex',
        'supported_paper_sizes',
    ];

    public function getSupportsColorAttribute(): bool
    {
        return (bool) ($this->capabilities['color'] ?? false);
    }

    public function getSupportsDuplexAttribute(): bool
    {
        return (bool) ($this->capabilities['duplex'] ?? false);
    }

    public function getSupportedPaperSizesAttribute(): array
    {
        return $this->capabilities['paper_sizes'] ?? ['A4'];
    }

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function printJobs()
    {
        return $this->hasMany(PrintJob::class);
    }
}
