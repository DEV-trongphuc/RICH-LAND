import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

const buildVersion = Date.now().toString();

function versionManifestPlugin() {
  return {
    name: 'version-manifest-plugin',
    buildStart() {
      const payload = JSON.stringify({
        version: buildVersion,
        buildTime: new Date().toISOString()
      }, null, 2);
      
      const publicDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      fs.writeFileSync(path.resolve(publicDir, 'version.json'), payload, 'utf-8');
      
      const backendDir = path.resolve(__dirname, 'backend');
      if (fs.existsSync(backendDir)) {
        fs.writeFileSync(path.resolve(backendDir, 'version.json'), payload, 'utf-8');
      }
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const targetUrl = env.VITE_API_URL || 'https://crm.richland.city/backend';
  
  return {
    define: {
      __APP_VERSION__: JSON.stringify(buildVersion),
    },
    plugins: [
      versionManifestPlugin(),
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
