import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// La version est inscrite dans index.html ; on la scelle aussi dans le code.
// La balise dit de quelle page vient le HTML, la constante dit quel JavaScript
// tourne vraiment — et c'est celui-la qui decide du comportement.
const version =
  readFileSync('index.html', 'utf8').match(
    /name="cmp-build"\s+content="([^"]+)"/,
  )?.[1] || 'inconnue';

// L'app est servie à la racine du domaine du tunnel (ex. https://cmp.exemple.fr/).
// Surchargeable au build via VITE_BASE si besoin.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  define: { __CMP_BUILD__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        // `id` donne a l'application une identite stable, independante de
        // l'URL : c'est ce a quoi le systeme la reconnait d'une version a
        // l'autre. Sans lui, il se rabat sur start_url, donc sur le domaine.
        id: '/?app=cmp',
        name: 'Charge mentale partagée',
        short_name: 'Charge mentale partagée',
        description: 'La liste des choses à porter, à deux.',
        lang: 'fr',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FBF4EC',
        theme_color: '#FBF4EC',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/(rest|auth|realtime)\/v1/],
        runtimeCaching: [
          {
            // Lecture hors ligne : on garde la dernière réponse REST connue.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/rest/v1'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cmp-rest',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
