<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="origin">
    <link rel="icon" type="image/png" href="{{ Vite::asset('frontend/src/assets/brand/hirgal-app-icon.png') }}">
    <title>Hirgal | Workspace</title>
    @viteReactRefresh
    @vite('frontend/src/inertia.tsx')
    @inertiaHead
</head>
<body>
    @inertia
</body>
</html>
