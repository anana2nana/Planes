import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging'
import { httpsCallable } from 'firebase/functions'
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, db, functions } from './firebase'
import type { PersonId } from './types'

export type PushStatus = 'checking' | 'unsupported' | 'blocked' | 'off' | 'on'

const TOKEN_KEY = 'nitakitos.pushToken'

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
const writeToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* sin almacenamiento: se volverá a pedir el token la próxima vez */
  }
}

export async function pushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'Notification' in window && 'PushManager' in window && (await isSupported())
}

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('No se pudo registrar el service worker', e))
  }
}

export async function currentPushStatus(): Promise<PushStatus> {
  if (!(await pushSupported())) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' && readToken() ? 'on' : 'off'
}

/** Obtiene (o renueva) el token de este móvil y lo guarda para que el servidor sepa dónde enviar. */
async function syncToken(me: PersonId): Promise<string> {
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(app), {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  const previous = readToken()
  if (previous && previous !== token) await deleteDoc(doc(db, 'devices', previous)).catch(() => {})
  await setDoc(doc(db, 'devices', token), {
    token,
    person: me,
    userAgent: navigator.userAgent.slice(0, 200),
    updatedAt: serverTimestamp(),
  })
  writeToken(token)
  return token
}

/** Pide permiso y activa las notificaciones en este dispositivo. */
export async function enablePush(me: PersonId): Promise<PushStatus> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  await syncToken(me)
  return 'on'
}

export async function disablePush(): Promise<PushStatus> {
  const token = readToken()
  writeToken(null)
  if (token) await deleteDoc(doc(db, 'devices', token)).catch(() => {})
  await deleteToken(getMessaging(app)).catch(() => {})
  return 'off'
}

/** Al abrir la app: si ya estaban activadas, renueva el token (FCM lo rota de vez en cuando). */
export async function refreshPush(me: PersonId) {
  if ((await currentPushStatus()) === 'on') await syncToken(me).catch((e) => console.warn('No se pudo renovar el token', e))
}

export const sendTestPush = () => httpsCallable(functions, 'sendTestNotification')()
