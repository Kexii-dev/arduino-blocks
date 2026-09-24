import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Version du projet lue depuis package.json, injectée dans l'app (src/version.js).
const APP_VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  define: { 'import.meta.env.APP_VERSION': JSON.stringify(APP_VERSION) },
  base: './',                       // build relatif : déployable sous /arduino/ comme le legacy
  server: {
    host: '0.0.0.0',
    port: 5173,
    // Autorise l'accès via le tunnel Cloudflare (arduino.kexii.dev) : Vite bloque
    // par défaut les Host inconnus (403 "Blocked request").
    allowedHosts: ['arduino.kexii.dev'],
    // En dev, le front (servi par Vite) n'a pas le /api nginx -> proxy serveur vers
    // le backend de prod réel (arduino-compile via nginx). Évite tout problème CORS
    // et permet de valider compile + comptes sans toucher au front de prod.
    proxy: {
      '/api': {
        target: 'https://arduino.rayroud.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
