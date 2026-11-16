// Segunda app del repo: bbs (planes y sitios de Nita, Kitos y María).
// `npm run dev:bbs` / `npm run build:bbs` → dist-bbs/ (el proyecto de Vercel de bbs publica esa carpeta).
// Usa el mismo código de src/ y las mismas variables de entorno (.env.production en la raíz).
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  root: here('./bbs'),
  envDir: here('.'),
  publicDir: here('./bbs/public'),
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
  build: {
    outDir: here('./dist-bbs'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
})
