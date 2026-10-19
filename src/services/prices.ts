import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '../lib/firebase'
import { unpackRows, type Product } from '../lib/prices'

export interface Catalog {
  items: Product[]
  updatedAt: Date | null
  wh: string
  /** Apartados de Mercadona que no se pudieron descargar la última vez. */
  failed: number
}

// El catálogo de Mercadona se lee una vez por sesión (unos pocos documentos; quedan en la caché del móvil).
let mercadona: Promise<Catalog> | null = null

export function loadMercadona(force = false): Promise<Catalog> {
  if (!mercadona || force)
    mercadona = (async () => {
      const meta = await getDoc(doc(db, 'catalog', 'mercadona'))
      if (!meta.exists()) return { items: [], updatedAt: null, wh: '', failed: 0 }
      const n = Number(meta.get('chunks') ?? 0)
      const parts = await Promise.all(Array.from({ length: n }, (_, i) => getDoc(doc(db, 'catalog', `mercadona-${i}`))))
      return {
        items: parts.flatMap((p) => (p.exists() ? unpackRows(String(p.get('rows') ?? '[]'), 'mercadona') : [])),
        updatedAt: meta.get('updatedAt')?.toDate?.() ?? null,
        wh: String(meta.get('wh') ?? ''),
        failed: Number(meta.get('failed') ?? 0),
      }
    })().catch((e) => {
      mercadona = null
      throw e
    })
  return mercadona
}

/** Pide al servidor que descargue el catálogo de Mercadona ahora (tarda 1-2 minutos). */
export async function downloadMercadona(): Promise<number> {
  const res = await httpsCallable<void, { count: number }>(functions, 'shopCatalogNow', { timeout: 540_000 })()
  return res.data.count
}

/** Buscar en Ahorramás (lo hace el servidor en su web). */
export async function searchAhorramas(q: string): Promise<Product[]> {
  const res = await httpsCallable<{ q: string }, { items: Product[] }>(functions, 'shopSearch', { timeout: 40_000 })({ q })
  return res.data.items ?? []
}
