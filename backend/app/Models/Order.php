<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'order_number',
        'customer_name',
        'customer_phone',
        'customer_email',
        'subtotal_amount',
        'tax_amount',
        'total_amount',
        'pricing_snapshot',
        'status',
        'qr_token_used',
    ];

    protected $casts = [
        'subtotal_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'pricing_snapshot' => 'array',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function files()
    {
        return $this->hasMany(OrderFile::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function latestPayment()
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    public function printJobs()
    {
        return $this->hasMany(PrintJob::class);
    }
}
