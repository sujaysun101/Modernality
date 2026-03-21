import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: 'src/renderer',
    base: './',
    build: {
        outDir: '../../dist/renderer',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/tesseract.js')) return 'tesseract';
                    if (id.includes('node_modules/katex')) return 'katex';
                    return undefined;
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src/renderer'),
            '@services': path.resolve(__dirname, 'src/services'),
        },
    },
    server: {
        port: 5173,
    },
});
