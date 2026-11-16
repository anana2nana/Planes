// Avisos de bbs en este móvil. Se apuntan en `bbsDevices/{token}` (aparte de `devices`, que es de la pareja).
// Vale igual en la app bbs que dentro de Nitakitos (baldosa): `app` dice cuál abrir al tocar el aviso.
import { deleteToken, getMessaging, getToken } from 'firebase/messaging'
import { httpsCallable } from 'firebase/functions'
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app as firebaseApp, db, functions } from '../lib/firebase'
import { pushSupported, type PushStatus } from '../lib/push'
import type { BbsPerson } from '../lib/bbs.ts'

export type BbsApp = 'bbs' | 'nitakitos'
const KEY = 'bbs.pushToken'

const read = () => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
const write = (t: string | null) => {
  try {
    if (t) localStorage.setItem(KEY, t)
    else localStorage.removeItem(KEY)
  } catch {
    /* sin almacenamiento: se pedirá otra vez */
  }
}

export async function bbsPushStatus(): Promise<PushStatus> {
  if (!(await pushSupported())) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' && read() ? 'on' : 'off'
}

async function sync(me: BbsPerson, appName: BbsApp) {
  const registration = await navigator.serviceWorker.ready
  const token = await getToken(getMessaging(firebaseApp), { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration })
  const previous = read()
  if (previous && previous !== token) await deleteDoc(doc(db, 'bbsDevices', previous)).catch(() => {})
  await setDoc(doc(db, 'bbsDevices', token), { token, person: me, app: appName, userAgent: navigator.userAgent.slice(0, 200), updatedAt: serverTimestamp() })
  write(token)
}

export async function enableBbsPush(me: BbsPerson, appName: BbsApp): Promise<PushStatus> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  await sync(me, appName)
  return 'on'
}

export async function disableBbsPush(appName: BbsApp): Promise<PushStatus> {
  const token = read()
  write(null)
  if (token) await deleteDoc(doc(db, 'bbsDevices', token)).catch(() => {})
  // En Nitakitos el token es el mismo que el de sus propios avisos: no se borra.
  if (appName === 'bbs') await deleteToken(getMessaging(firebaseApp)).catch(() => {})
  return 'off'
}

/** Al abrir: si estaban activados, renueva el token (FCM lo cambia de vez en cuando). */
export async function refreshBbsPush(me: BbsPerson, appName: BbsApp) {
  if ((await bbsPushStatus()) === 'on') await sync(me, appName).catch((e) => console.warn('No se pudo renovar el aviso de bbs', e))
}

export const testBbsPush = () => httpsCallable(functions, 'bbsTestPush')()
