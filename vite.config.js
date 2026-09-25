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
    // un backend de COMPILE. Pendant la feature Mega (2026-09-25), on pointe vers le
    // backend local de test (arduino-compile:dev, conteneur ard-compile-test :8095,
    // DB neuve) pour valider la compilation mega SANS toucher au backend de prod.
    // NB: ça concerne uniquement le dev ; la build prod sert /api via nginx.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8095',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
