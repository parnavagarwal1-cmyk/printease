<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PrintJob extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'printer_id',
        'claimed_by_device_id',
        'status',
        'job_lease_token',
        'leased_until',
        'downloaded_at',
        'spooled_at',
        'completed_at',
        'spooler_job_id',
    ];

    protected $casts = [
        'leased_until' => 'datetime',
        'downloaded_at' => 'datetime',
        'spooled_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function printer()
    {
        return $this->belongsTo(Printer::class);
    }

    public function claimedByDevice()
    {
        return $this->belongsTo(DesktopDevice::class, 'claimed_by_device_id');
    }

    public function attempts()
    {
        return $this->hasMany(PrintJobAttempt::class);
    }
}
