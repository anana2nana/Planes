import { initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore, type DocumentSnapshot } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { logger, setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineString } from 'firebase-functions/params'
import {
  LATE_GRACE_MIN,
  activityPushes,
  normalizePrefs,
  reminderPushes,
  type NotifPrefs,
  type Person,
  type PlanData,
  type Push,
} from './logic.js'

// europe-west1 es la región que corresponde a Firestore en eur3.
setGlobalOptions({ region: 'europe-west1', maxInstances: 2 })

initializeApp()
const db = getFirestore()

const NITA_EMAIL = defineString('NITA_EMAIL', { description: 'Email de Google de Nita' })
const KITOS_EMAIL = defineString('KITOS_EMAIL', { description: 'Email de Google de Kitos' })

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true'

// ─── Helpers ────────────────────────────────────────────────────────────────

function toPlan(snap: DocumentSnapshot): PlanData | null {
  if (!snap.exists) return null
  const d = snap.data()!
  return {
    id: snap.id,
    title: d.title ?? '',
    assignee: d.assignee ?? 'both',
    groupId: d.groupId ?? null,
    dueMs: d.dueAt instanceof Timestamp ? d.dueAt.toMillis() : null,
    allDay: d.allDay ?? false,
    done: d.done ?? false,
    doneBy: d.doneBy ?? null,
    createdBy: d.createdBy ?? 'nita',
    remindersSent: d.remindersSent ?? [],
  }
}

async function loadPrefs(): Promise<Record<Person, NotifPrefs>> {
  const data = (await db.doc('config/notifications').get()).data() ?? {}
  return { nita: normalizePrefs(data.nita), kitos: normalizePrefs(data.kitos) }
}

/** Envía una notificación a todos los dispositivos registrados de una persona. */
async function send(push: Push) {
  const devices = await db.collection('devices').where('person', '==', push.to).get()
  const tokens = devices.docs.map((d) => d.get('token') as string).filter(Boolean)

  if (isEmulator) {
    logger.info(`[push → ${push.to}] ${push.title} — ${push.body}`, { devices: tokens.length })
    return
  }
  if (tokens.length === 0) return

  // Mensaje solo de datos: el service worker (public/sw.js) decide cómo mostrarlo.
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    data: { title: push.title, body: push.body, tag: push.tag, kind: push.kind, url: '/' },
    webpush: { headers: { Urgency: 'high', TTL: String(push.kind === 'reminder' ? 3600 : 86400) } },
  })

  // Limpia los dispositivos cuyo token ya no es válido (app desinstalada, permisos revocados…).
  const stale = res.responses
    .map((r, i) => (!r.success && /registration-token-not-registered|invalid-argument|invalid-registration-token/.test(r.error?.code ?? '') ? tokens[i] : null))
    .filter((t): t is string => !!t)
  await Promise.all(stale.map((t) => db.doc(`devices/${t}`).delete()))
  logger.info(`push → ${push.to}: ${res.successCount} ok, ${res.failureCount} fallos, ${stale.length} tokens limpiados`)
}

// ─── Avisos al crear / completar planes ────────────────────────────────────

export const onPlanWritten = onDocumentWritten('plans/{planId}', async (event) => {
  const before = event.data?.before ? toPlan(event.data.before) : null
  const after = event.data?.after ? toPlan(event.data.after) : null

  // Si cambia la fecha tope, los recordatorios vuelven a empezar.
  if (before && after && before.dueMs !== after.dueMs && after.remindersSent.length > 0) {
    await event.data!.after.ref.update({ remindersSent: [] })
  }

  const pushes = activityPushes(before, after, Date.now())
  if (pushes.length === 0) return
  const prefs = await loadPrefs()
  await Promise.all(pushes.filter((p) => prefs[p.to].activity).map(send))
})

// ─── Recordatorios antes de la fecha tope ──────────────────────────────────

export const sendReminders = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Europe/Madrid' }, async () => {
  const now = Date.now()
  const prefs = await loadPrefs()
  const maxLead = Math.max(0, ...prefs.nita.leads, ...prefs.kitos.leads)

  const snap = await db
    .collection('plans')
    .where('done', '==', false)
    .where('dueAt', '>=', Timestamp.fromMillis(now - LATE_GRACE_MIN * 60_000))
    .where('dueAt', '<=', Timestamp.fromMillis(now + (maxLead + 5) * 60_000))
    .get()

  for (const doc of snap.docs) {
    const plan = toPlan(doc)!
    const { pushes, markSent } = reminderPushes(plan, prefs, now)
    if (markSent.length === 0) continue
    // Marcamos primero para no repetir el aviso si el envío falla a medias.
    await doc.ref.update({ remindersSent: FieldValue.arrayUnion(...markSent) })
    await Promise.all(pushes.map(send))
  }
})

// ─── Notificación de prueba (botón en Ajustes) ─────────────────────────────

export const sendTestNotification = onCall(async (req) => {
  const email = (req.auth?.token.email ?? '').toLowerCase()
  const person: Person | null =
    email && email === NITA_EMAIL.value().toLowerCase()
      ? 'nita'
      : email && email === KITOS_EMAIL.value().toLowerCase()
        ? 'kitos'
        : null
  if (!person || req.auth?.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Este espacio es privado.')
  }
  await send({
    to: person,
    kind: 'reminder',
    title: '🎉 ¡Notificaciones activadas!',
    body: 'Así te avisaremos de vuestros planes.',
    tag: 'test',
  })
  return { ok: true }
})
