<?php

use Illuminate\Support\Facades\Route;

Route::get('/{any?}', function () {
    $spaPath = public_path('index.html');
    if (file_exists($spaPath)) {
        return response()->file($spaPath);
    }
    return view('welcome');
})->where('any', '^(?!api).*$');
