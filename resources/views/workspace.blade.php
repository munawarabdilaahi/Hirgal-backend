<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <title>{{ config('app.name', 'Hirgal') }}</title>
    @viteReactRefresh
    @vite('frontend/src/inertia.tsx')
    @inertiaHead
</head>
<body>
    @inertia
</body>
</html>
