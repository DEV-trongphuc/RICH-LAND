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
          rewrite: (path) => path.replace(/^\/backend/, '')
        }
      }
    }
  };
});
