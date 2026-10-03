import { defineConfig, loadEnv } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// @ts-ignore - Node.js built-in modules are available in Vite config context
import { fileURLToPath } from 'url'
// @ts-ignore - Node.js built-in modules are available in Vite config context
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Local only: must match Laravel APP_URL (php artisan serve).
  const apiOrigin =
    env.VITE_APP_URL || env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [
      viteReact(),
      tailwindcss(),
      {
        name: 'html-transform',
        transformIndexHtml(html) {
          // Empty in production → relative "/". Absolute URL only needed for OG tags.
          const frontendUrl = (env.VITE_FRONTEND_URL || '').replace(/\/$/, '')
          return html.replace(/%VITE_FRONTEND_URL%/g, frontendUrl)
        },
      },
    ],
    test: {
      globals: true,
      environment: 'jsdom',
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 3000,
      proxy: {
        // Browser: http://localhost:3000/api/* → Laravel APP_URL /api/*
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
        },
        '/storage': {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 3000,
      proxy: {
        '/api': {
          target: apiOrigin,
          changeOrigin: true,
        },
        '/storage': {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
  }
})
