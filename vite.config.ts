import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base relative : le jeu fonctionne quel que soit le nom du dépôt GitHub Pages et hors ligne.
export default defineConfig({ base: './', plugins: [preact()], worker: { format: 'es' }, build: { target: 'es2022', chunkSizeWarningLimit: 1500 }, test: { include: ['tests/**/*.test.ts'], testTimeout: 120000 } } as any);
