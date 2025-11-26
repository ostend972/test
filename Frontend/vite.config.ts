import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    // Performance optimizations
    build: {
      // Code splitting for optimal loading
      rollupOptions: {
        output: {
          manualChunks: {
            // Split React into separate chunk
            'react-vendor': ['react', 'react-dom'],
            // Router in separate chunk (loaded on demand)
            'react-router': ['react-router-dom'],
            // Charts library (heavy, load when needed)
            'charts': ['recharts'],
            // Query library
            'query': ['@tanstack/react-query']
          }
        }
      },
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
      // Enable minification with aggressive options
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production', // Remove console.log in production
          drop_debugger: true,
          pure_funcs: mode === 'production' ? ['console.log', 'console.info'] : []
        }
      },
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Source maps only in development
      sourcemap: mode === 'development'
    }
  };
});
