<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Branch extends Model
{
    use HasFactory;

    protected $fillable = [
        'shop_id',
        'name',
        'code',
        'address',
        'city',
        'state',
        'pincode',
        'phone',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function shop()
    {
        return $this->belongsTo(Shop::class);
    }

    public function printers()
    {
        return $this->hasMany(Printer::class);
    }

    public function desktopDevices()
    {
        return $this->hasMany(DesktopDevice::class);
    }

    public function qrCodes()
    {
        return $this->hasMany(QrCode::class);
    }

    public function activeQrCode()
    {
        return $this->hasOne(QrCode::class)->where('is_active', true)->latestOfMany();
    }

    public function pricingRules()
    {
        return $this->hasMany(PricingRule::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }
}
