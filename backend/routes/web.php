<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    $spaPath = public_path('index.html');
    if (file_exists($spaPath)) {
        return response(file_get_contents($spaPath))->header('Content-Type', 'text/html');
    }
    return view('welcome');
});

Route::fallback(function () {
    $spaPath = public_path('index.html');
    if (file_exists($spaPath)) {
        return response(file_get_contents($spaPath))->header('Content-Type', 'text/html');
    }
    return view('welcome');
});
