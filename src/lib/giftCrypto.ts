// Cifrado de las ideas de regalo con una contraseña de cada uno (AES-GCM, clave
// derivada con PBKDF2). Así ni siquiera desde la consola de Firebase se pueden leer.
// Funciona igual en el navegador y en Node (tests/giftCrypto.test.ts).

export const ITERATIONS = 310_000
export const MIN_PASSWORD = 8

const enc = new TextEncoder()
const dec = new TextDecoder()

export const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export const randomSalt = () => crypto.getRandomValues(new Uint8Array(16))

export async function deriveKey(password: string, salt: Uint8Array, iterations = ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toB64(new Uint8Array(await crypto.subtle.exportKey('raw', key)))
}
export async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromB64(raw) as BufferSource, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

/** Cifra cualquier objeto: "iv + datos cifrados" en base64. */
export async function seal(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv)
  out.set(ct, iv.length)
  return toB64(out)
}

/** Descifra; lanza un error si la clave no es la buena. */
export async function open<T>(key: CryptoKey, sealed: string): Promise<T> {
  const all = fromB64(sealed)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, key, all.slice(12))
  return JSON.parse(dec.decode(pt)) as T
}

const CHECK = 'nitakitos-regalos'
/** Un texto cifrado que sirve para comprobar si una contraseña es la correcta. */
export const makeCheck = (key: CryptoKey) => seal(key, CHECK)
export async function verify(key: CryptoKey, check: string): Promise<boolean> {
  try {
    return (await open<string>(key, check)) === CHECK
  } catch {
    return false
  }
}
