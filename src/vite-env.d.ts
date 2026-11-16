/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_VAPID_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_NITA_EMAIL: string
  readonly VITE_KITOS_EMAIL: string
  /** Solo bbs: el email de María (no está en el repo). */
  readonly VITE_MARIA_EMAIL?: string
  /** En Nitakitos: la dirección de bbs, para el enlace que ve María. */
  readonly VITE_BBS_URL?: string
  readonly VITE_USE_EMULATORS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
