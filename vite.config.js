import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/js/app.js',
                'frontend/src/inertia.tsx',
                'frontend/src/assets/brand/hirgal-favicon-16.png',
                'frontend/src/assets/brand/hirgal-favicon-32.png',
                'frontend/src/assets/brand/hirgal-favicon-48.png',
                'frontend/src/assets/brand/hirgal-apple-touch-icon.png',
            ],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        tailwindcss(),
        react(),
    ],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./frontend/src', import.meta.url)) },
        dedupe: ['react', 'react-dom'],
    },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
