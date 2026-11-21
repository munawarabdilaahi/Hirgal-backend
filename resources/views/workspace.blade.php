<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="origin">
    <link rel="icon" type="image/x-icon" href="{{ asset('favicon.ico') }}" sizes="any">
    <link rel="icon" type="image/png" sizes="16x16" href="{{ Vite::asset('frontend/src/assets/brand/hirgal-favicon-16.png') }}">
    <link rel="icon" type="image/png" sizes="32x32" href="{{ Vite::asset('frontend/src/assets/brand/hirgal-favicon-32.png') }}">
    <link rel="icon" type="image/png" sizes="48x48" href="{{ Vite::asset('frontend/src/assets/brand/hirgal-favicon-48.png') }}">
    <link rel="apple-touch-icon" sizes="180x180" href="{{ Vite::asset('frontend/src/assets/brand/hirgal-apple-touch-icon.png') }}">
    <title>Hirgal | Workspace</title>
    @viteReactRefresh
    @vite('frontend/src/inertia.tsx')
    @inertiaHead
</head>
<body>
    @inertia
</body>
</html>
