<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'phone',
        'role',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function ownedShops()
    {
        return $this->hasMany(Shop::class, 'owner_id');
    }

    public function memberships()
    {
        return $this->hasMany(ShopMember::class);
    }

    public function shops()
    {
        return $this->belongsToMany(Shop::class, 'shop_members')
            ->withPivot(['role', 'branch_id'])
            ->withTimestamps();
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function isShopOwner(): bool
    {
        return $this->role === 'shop_owner' || $this->isSuperAdmin();
    }

    public function canAccessShop(int $shopId): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return $this->ownedShops()->where('id', $shopId)->exists()
            || $this->memberships()->where('shop_id', $shopId)->exists();
    }

    public function canAccessBranch(int $branchId): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        $branch = Branch::find($branchId);
        if (!$branch) {
            return false;
        }

        if ($this->ownedShops()->where('id', $branch->shop_id)->exists()) {
            return true;
        }

        $membership = $this->memberships()->where('shop_id', $branch->shop_id)->first();
        if (!$membership) {
            return false;
        }

        // Shop owners/managers can access all branches; staff may be limited to specific branch
        if ($membership->role === 'shop_owner' || $membership->role === 'branch_manager') {
            return true;
        }

        return $membership->branch_id === $branchId;
    }
}
