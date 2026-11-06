<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DesktopDevice extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'device_name',
        'device_uuid',
        'pairing_code',
        'pairing_code_expires_at',
        'auth_token_hash',
        'app_version',
        'os_info',
        'selected_printer_id',
        'last_heartbeat_at',
        'status',
    ];

    protected $casts = [
        'pairing_code_expires_at' => 'datetime',
        'last_heartbeat_at' => 'datetime',
    ];

    protected $hidden = [
        'auth_token_hash',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function selectedPrinter()
    {
        return $this->belongsTo(Printer::class, 'selected_printer_id');
    }

    public function printJobs()
    {
        return $this->hasMany(PrintJob::class, 'claimed_by_device_id');
    }

    public function attempts()
    {
        return $this->hasMany(PrintJobAttempt::class, 'device_id');
    }
}
