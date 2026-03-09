/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vite.dev/config/
export default defineConfig(({ mode: _mode }) => ({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __VERCEL_ENV__: JSON.stringify(process.env.VERCEL_ENV || ''),
  },
  envDir: '.',
  // Vite auto-loads .env.[mode] files — running `vite` loads .env.development,
  // running `vite build` loads .env.production
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/lib/**', 'src/config/**', 'src/context/**'],
    },
  },
}))
