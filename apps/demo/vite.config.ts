import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: { alias: [
    { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    { find: /^@qui-theme\/ui$/, replacement: fileURLToPath(new URL('../../packages/qui-ui/src/index.ts', import.meta.url)) },
    { find: /^@qui-theme\/ui\/icon$/, replacement: fileURLToPath(new URL('../../packages/qui-ui/src/icon.ts', import.meta.url)) },
    { find: /^@qui-theme\/ui\/icons$/, replacement: fileURLToPath(new URL('../../packages/qui-ui/src/icons.ts', import.meta.url)) },
    { find: /^@qui-theme\/ui\/icon-index$/, replacement: fileURLToPath(new URL('../../packages/qui-ui/src/icon-index.ts', import.meta.url)) },
    { find: /^@qui-theme\/ui\/icon-groups$/, replacement: fileURLToPath(new URL('../../packages/qui-ui/src/icon-groups.ts', import.meta.url)) },
    { find: /^@qui-theme\/ui\/theme$/, replacement: fileURLToPath(new URL('../../packages/qui-ui/src/theme.ts', import.meta.url)) },
    { find: /^@qui-theme\/ui\/assets$/, replacement: fileURLToPath(new URL('../../packages/qui-ui/src/assets.ts', import.meta.url)) },
  ] },
  server: { host: '127.0.0.1' },
})
