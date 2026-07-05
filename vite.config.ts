import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const targetUrl = env.VITE_API_URL || 'https://open.domation.net/richland';
  
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    build: {
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('recharts') || id.includes('d3')) {
                return 'vendor-charts';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
              return 'vendor';
            }
          }
        }
      }
    },
    server: {
      proxy: {
        '/backend': {
          target: targetUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/backend/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Override User-Agent to standard desktop Chrome to bypass Imunify360 bot-protection for E2E tests and local dev
              proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
              // Remove automation headers if present
              proxyReq.removeHeader('x-playwright-version');
              proxyReq.removeHeader('x-cypress-instance');
              proxyReq.removeHeader('x-puppeteer-version');
            });
          }
        }
      }
    }
  };
});
