<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PricingRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id',
        'paper_size',
        'bw_single_price',
        'bw_duplex_price',
        'color_single_price',
        'color_duplex_price',
        'duplex_pricing_mode', // 'per_side' or 'per_sheet'
        'min_order_amount',
        'tax_rate_percent',
        'is_active',
    ];

    protected $casts = [
        'bw_single_price' => 'decimal:2',
        'bw_duplex_price' => 'decimal:2',
        'color_single_price' => 'decimal:2',
        'color_duplex_price' => 'decimal:2',
        'min_order_amount' => 'decimal:2',
        'tax_rate_percent' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }
}
