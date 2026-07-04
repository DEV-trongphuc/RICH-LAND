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
