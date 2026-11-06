<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'order_file_id',
        'page_range',
        'selected_page_count',
        'copies',
        'paper_size',
        'print_mode',
        'duplex_mode',
        'sheet_count',
        'unit_price',
        'line_total',
    ];

    protected $casts = [
        'selected_page_count' => 'integer',
        'copies' => 'integer',
        'sheet_count' => 'integer',
        'unit_price' => 'decimal:2',
        'line_total' => 'decimal:2',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function orderFile()
    {
        return $this->belongsTo(OrderFile::class);
    }
}
