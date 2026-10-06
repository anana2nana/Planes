import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // El SDK de Firebase es grande; para una app privada de 2 personas no merece la pena trocearlo.
    chunkSizeWarningLimit: 1200,
  },
})
