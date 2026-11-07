<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    $spaPath = public_path('index.html');
    if (file_exists($spaPath)) {
        return response()->file($spaPath);
    }
    return view('welcome');
});

Route::fallback(function () {
    $spaPath = public_path('index.html');
    if (file_exists($spaPath)) {
        return response()->file($spaPath);
    }
    return view('welcome');
});
