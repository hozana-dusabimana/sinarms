import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Backend target for the dev-server proxy. Defaults to localhost for native
// `npm run dev`; docker-compose sets it to the backend service hostname.
const backendTarget = process.env.BACKEND_PROXY_TARGET || 'http://localhost:4000'
// File-event watching is unreliable across Docker Desktop bind mounts on
// Windows/macOS, so fall back to polling when running in a container.
const usePolling = process.env.VITE_USE_POLLING === 'true'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    watch: usePolling ? { usePolling: true } : undefined,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/ai': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/test/**/*.test.{js,jsx,ts,tsx}'],
    css: false,
    globals: true,
  },
  esbuild: {
    // @vitejs/plugin-react@6 + vitest can drop the automatic JSX runtime in
    // some setups, leaving test files with bare `<Component />` JSX that
    // compiles to `React.createElement(...)` with no `React` in scope. Inject
    // the import so existing tests don't all fail with "React is not defined".
    jsxInject: "import React from 'react'",
  },
})
