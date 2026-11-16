// Entrada de la app bbs (vite.bbs.config.ts). Reutiliza src/: Firebase, Maps, hojas… y el módulo src/bbs.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BbsApp } from '../src/bbs/BbsApp'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { registerServiceWorker } from '../src/lib/push'
import '@fontsource-variable/plus-jakarta-sans'
import './bbs.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BbsApp />
    </ErrorBoundary>
  </StrictMode>,
)

// bbs/public/sw.js: su propio service worker (avisos con el icono y el nombre de bbs).
registerServiceWorker()
