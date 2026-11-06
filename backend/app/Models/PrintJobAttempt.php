<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PrintJobAttempt extends Model
{
    use HasFactory;

    protected $fillable = [
        'print_job_id',
        'device_id',
        'attempt_number',
        'status',
        'error_message',
        'telemetry',
    ];

    protected $casts = [
        'attempt_number' => 'integer',
        'telemetry' => 'array',
    ];

    public function printJob()
    {
        return $this->belongsTo(PrintJob::class);
    }

    public function device()
    {
        return $this->belongsTo(DesktopDevice::class, 'device_id');
    }
}
