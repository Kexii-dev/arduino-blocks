import { defineConfig } from 'vite';

export default defineConfig({
  base: './',                       // build relatif : déployable sous /arduino/ comme le legacy
  server: {
    host: '0.0.0.0',
    port: 5173,
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