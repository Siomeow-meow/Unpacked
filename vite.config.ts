import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/* GitHub Pages serves a project site under /<repo-name>/. The base below is /Unpacked/, so the repository must be named
   Unpacked. For any other name build with VITE_BASE=/<repo-name>/ (for a user site at the root, VITE_BASE=/). */
const base = process.env.VITE_BASE || '/Unpacked/';

export default defineConfig({
    base,
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
            manifest: {
                name: 'Unpacked',
                short_name: 'Unpacked',
                description: 'Step-by-step lessons that show where every number comes from. Works offline.',
                theme_color: '#3b5bdb',
                background_color: '#f5f6fa',
                display: 'standalone',
                categories: ['education'],
                icons: [
                    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
                ]
            },
            /* our own small service worker (src/sw.ts): it precaches every file of the build */
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'] }
        })
    ],
    build: { target: 'es2020' },
    test: { environment: 'node', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] }
});
