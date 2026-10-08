import { useCallback, useEffect, useState } from 'react'
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { deriveKey, exportKey, fromB64, importKey, ITERATIONS, makeCheck, open, randomSalt, seal, toB64, verify } from '../lib/giftCrypto'
import { OCCASIONS, STATUS, type Gift, type GiftOccasion, type GiftStatus } from '../lib/gifts'
import type { PersonId } from '../lib/types'

const col = collection(db, 'gifts')
/** Sal y comprobación de la contraseña de regalos de cada uno (nunca la clave). */
const keys = collection(db, 'giftKeys')

/** Lo que va cifrado: todo lo que dice qué regalo es. Ocasión y estado quedan a la vista para los avisos. */
interface Secret {
  title: string
  url: string
  price: number | null
  notes: string
}

// ─── La clave de cada uno ──────────────────────────────────────────────────

const LOCAL = (me: PersonId) => `nitakitos.giftKey.${me}`
const cache = new Map<PersonId, CryptoKey>()

export type KeyState = { status: 'loading' } | { status: 'none' } | { status: 'locked' } | { status: 'ready'; key: CryptoKey }

/** Estado de la contraseña de regalos: sin crear, bloqueada en este móvil o lista. */
export function useGiftKey(me: PersonId) {
  const [state, setState] = useState<KeyState>(() => (cache.has(me) ? { status: 'ready', key: cache.get(me)! } : { status: 'loading' }))
  const [meta, setMeta] = useState<{ salt: string; check: string; iterations: number } | null>(null)

  useEffect(
    () =>
      onSnapshot(
        doc(keys, me),
        async (s) => {
          if (!s.exists()) {
            cache.delete(me)
            setMeta(null)
            setState({ status: 'none' })
            return
          }
          const m = { salt: String(s.get('salt')), check: String(s.get('check')), iterations: Number(s.get('iterations')) || ITERATIONS }
          setMeta(m)
          // ¿Este móvil ya la tiene guardada (y sigue siendo la buena)?
          let key = cache.get(me) ?? null
          if (!key) {
            try {
              const raw = localStorage.getItem(LOCAL(me))
              if (raw) key = await importKey(raw)
            } catch {
              key = null
            }
          }
          if (key && (await verify(key, m.check))) {
            cache.set(me, key)
            setState({ status: 'ready', key })
          } else {
            cache.delete(me)
            setState({ status: 'locked' })
          }
        },
        () => setState({ status: 'none' }),
      ),
    [me],
  )

  /** Crea la contraseña y cifra las ideas que hubiera sin cifrar. */
  const setup = useCallback(
    async (password: string) => {
      const salt = randomSalt()
      const key = await deriveKey(password, salt)
      await setDoc(doc(keys, me), { salt: toB64(salt), check: await makeCheck(key), iterations: ITERATIONS, updatedAt: serverTimestamp() })
      await remember(me, key)
      setState({ status: 'ready', key })
      await encryptLegacy(me, key)
    },
    [me],
  )

  /** Desbloquea en este móvil. Devuelve false si la contraseña no es la buena. */
  const unlock = useCallback(
    async (password: string) => {
      if (!meta) return false
      const key = await deriveKey(password, fromB64(meta.salt), meta.iterations)
      if (!(await verify(key, meta.check))) return false
      await remember(me, key)
      setState({ status: 'ready', key })
      await encryptLegacy(me, key)
      return true
    },
    [me, meta],
  )

  /** Si se olvida la contraseña: se borran sus ideas (no hay forma de leerlas) y se empieza de cero. */
  const reset = useCallback(async () => {
    const snap = await getDocs(query(col, where('owner', '==', me)))
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(doc(keys, me))
    await batch.commit()
    cache.delete(me)
    try {
      localStorage.removeItem(LOCAL(me))
    } catch {
      /* nada */
    }
  }, [me])

  return { state, setup, unlock, reset }
}

async function remember(me: PersonId, key: CryptoKey) {
  cache.set(me, key)
  try {
    localStorage.setItem(LOCAL(me), await exportKey(key))
  } catch {
    /* sin almacenamiento: habrá que escribirla cada vez */
  }
}

/** Cifra las ideas antiguas (de antes de la contraseña). */
async function encryptLegacy(me: PersonId, key: CryptoKey) {
  const snap = await getDocs(query(col, where('owner', '==', me)))
  await Promise.all(
    snap.docs
      .filter((d) => typeof d.get('enc') !== 'string')
      .map(async (d) => {
        const x = d.data()
        const secret: Secret = { title: x.title ?? '', url: x.url ?? '', price: typeof x.price === 'number' ? x.price : null, notes: x.notes ?? '' }
        await updateDoc(d.ref, { enc: await seal(key, secret), title: '🔒', url: '', price: null, notes: '' })
      }),
  )
}

// ─── Las ideas ─────────────────────────────────────────────────────────────

/** Solo las ideas de quien mira (las reglas impiden leer las del otro), ya descifradas. */
export function useGifts(me: PersonId, key: CryptoKey | null) {
  const [gifts, setGifts] = useState<Gift[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!key) return
    return onSnapshot(
      query(col, where('owner', '==', me)),
      async (snap) => {
        const list = await Promise.all(
          snap.docs.map(async (d) => {
            const x = d.data({ serverTimestamps: 'estimate' })
            let secret: Secret = { title: x.title ?? '', url: typeof x.url === 'string' ? x.url : '', price: typeof x.price === 'number' ? x.price : null, notes: x.notes ?? '' }
            if (typeof x.enc === 'string') {
              try {
                secret = await open<Secret>(key, x.enc)
              } catch {
                secret = { title: '🔒 (no se puede leer)', url: '', price: null, notes: '' }
              }
            }
            return {
              id: d.id,
              owner: me,
              ...secret,
              occasion: (x.occasion in OCCASIONS ? x.occasion : 'otra') as GiftOccasion,
              status: (x.status in STATUS ? x.status : 'idea') as GiftStatus,
              createdAt: x.createdAt?.toMillis?.() ?? 0,
            }
          }),
        )
        setGifts(list.sort((a, b) => b.createdAt - a.createdAt))
        setLoading(false)
      },
      () => setLoading(false),
    )
  }, [me, key])
  return { gifts, loading }
}

export async function saveGift(g: Omit<Gift, 'id' | 'owner' | 'createdAt'> & { id?: string }, me: PersonId, key: CryptoKey) {
  const { id, title, url, price, notes, occasion, status } = g
  const enc = await seal(key, { title, url, price, notes } satisfies Secret)
  // En claro solo queda lo necesario para los avisos (ocasión y estado). El título visible es un candado.
  return setDoc(id ? doc(col, id) : doc(col), { owner: me, occasion, status, enc, title: '🔒', url: '', price: null, notes: '', ...(id ? {} : { createdAt: serverTimestamp() }) }, { merge: true })
}
export const setGiftStatus = (id: string, status: GiftStatus) => updateDoc(doc(col, id), { status })
export const deleteGift = (id: string) => deleteDoc(doc(col, id))
