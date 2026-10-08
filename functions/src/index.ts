// Todas las fechas (repeticiones, "hoy", "mañana") en hora de España.
process.env.TZ = 'Europe/Madrid'

import { initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore, type DocumentSnapshot } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { logger, setGlobalOptions } from 'firebase-functions/v2'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { defineString } from 'firebase-functions/params'
import { parseRepeat } from './recurrence.js'
import { ECB_EURIBOR_URL, parseEcbCsv } from './euribor.js'
import { homePushes } from './homeAlerts.js'
import type { Amount, CategoryId, Fund, HomeConfig, HomeItem, MonthlySchedule } from './home.js'
import {
  LATE_GRACE_MIN,
  activityPushes,
  digestPush,
  normalizePrefs,
  reminderPushes,
  rolloverDue,
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
    kind: d.kind === 'event' || d.kind === 'task' ? d.kind : 'plan',
    title: d.title ?? '',
    assignee: d.assignee ?? 'both',
    groupId: d.groupId ?? null,
    dueMs: d.dueAt instanceof Timestamp ? d.dueAt.toMillis() : null,
    allDay: d.allDay ?? false,
    done: d.done ?? false,
    doneBy: d.doneBy ?? null,
    createdBy: d.createdBy ?? 'nita',
    remindersSent: d.remindersSent ?? [],
    spawnedFrom: d.spawnedFrom ?? null,
    repeat: parseRepeat(d.repeat),
    remindWeekBefore: d.remindWeekBefore === true,
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
  // + 1 semana por el aviso previo de las citas (cumpleaños).
  const maxLead = Math.max(7 * 24 * 60, ...prefs.nita.leads, ...prefs.kitos.leads)

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

  // Citas repetidas que ya pasaron → a su siguiente fecha (el cambio de fecha
  // reinicia sus recordatorios en onPlanWritten).
  const past = await db
    .collection('plans')
    .where('kind', '==', 'event')
    .where('dueAt', '<', Timestamp.fromMillis(now - LATE_GRACE_MIN * 60_000))
    .get()
  for (const doc of past.docs) {
    const next = rolloverDue(toPlan(doc)!, now)
    if (next !== null) await doc.ref.update({ dueAt: Timestamp.fromMillis(next) })
  }
})

// ─── Notificación de prueba (botón en Ajustes) ─────────────────────────────

/** Persona a partir del usuario que llama (o null si no es ninguno de los dos). */
function personOf(auth: { token: { email?: string; email_verified?: boolean } } | undefined): Person | null {
  const email = (auth?.token.email ?? '').toLowerCase()
  if (!email || auth?.token.email_verified !== true) return null
  if (email === NITA_EMAIL.value().toLowerCase()) return 'nita'
  if (email === KITOS_EMAIL.value().toLowerCase()) return 'kitos'
  return null
}

export const sendTestNotification = onCall(async (req) => {
  const person = personOf(req.auth)
  if (!person) throw new HttpsError('permission-denied', 'Este espacio es privado.')
  await send({
    to: person,
    kind: 'reminder',
    title: '🎉 ¡Notificaciones activadas!',
    body: 'Así te avisaremos de vuestros planes.',
    tag: 'test',
  })
  return { ok: true }
})

// ─── Euríbor (para el simulador de hipoteca) ───────────────────────────────

async function storeEuribor() {
  const res = await fetch(ECB_EURIBOR_URL, { headers: { Accept: 'text/csv' } })
  if (!res.ok) throw new Error(`BCE respondió ${res.status}`)
  const history = parseEcbCsv(await res.text())
  const last = history[history.length - 1]
  if (!last) throw new Error('El BCE no devolvió datos')
  await db.doc('rates/euribor').set({
    value: last.value,
    month: last.month,
    history,
    source: 'BCE · Euribor 1-year (media mensual)',
    updatedAt: FieldValue.serverTimestamp(),
  })
  logger.info(`Euríbor ${last.month}: ${last.value} %`)
  return last
}

/** Cada mañana (el BCE publica la media de cada mes a primeros del siguiente). */
export const updateEuribor = onSchedule({ schedule: 'every day 08:30', timeZone: 'Europe/Madrid' }, async () => {
  await storeEuribor()
})

/** Botón "Actualizar" del simulador. */
export const refreshEuribor = onCall(async (req) => {
  if (!personOf(req.auth)) throw new HttpsError('permission-denied', 'Este espacio es privado.')
  try {
    return await storeEuribor()
  } catch (e) {
    throw new HttpsError('unavailable', (e as Error).message)
  }
})

// ─── Resumen de la mañana ──────────────────────────────────────────────────

/** Cada hora en punto: a quien tenga el resumen a esta hora, le manda lo de hoy. */
export const dailyDigest = onSchedule({ schedule: '0 * * * *', timeZone: 'Europe/Madrid' }, async () => {
  const now = new Date()
  const prefs = await loadPrefs()
  const people = (['nita', 'kitos'] as const).filter((p) => prefs[p].digest && prefs[p].digestHour === now.getHours())
  if (people.length === 0) return
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const snap = await db.collection('plans').where('done', '==', false).where('dueAt', '<', Timestamp.fromDate(endOfToday)).get()
  const plans = snap.docs.map((d) => toPlan(d)!)
  for (const person of people) {
    const push = digestPush(person, plans, now.getTime())
    if (push) await send(push)
  }
})

// ─── Avisos de la casa (cooperativa) ───────────────────────────────────────

function parseHome(d: Record<string, unknown> | undefined): HomeConfig | null {
  if (!d || typeof d.basePrice !== 'number') return null
  const m = (d.mortgage ?? {}) as Partial<HomeConfig['mortgage']>
  const s = (d.monthlySaving ?? {}) as Partial<HomeConfig['monthlySaving']>
  return {
    name: typeof d.name === 'string' ? d.name : 'MEROE',
    basePrice: d.basePrice,
    vatRate: typeof d.vatRate === 'number' ? d.vatRate : 0.1,
    handover: typeof d.handover === 'string' ? d.handover : '2028-10',
    mortgage: { pct: 0.8, years: 30, type: 'fixed', fixedRate: 2.5, spread: 0.7, mixedYears: 10, manualEuribor: null, ...m },
    monthlySaving: { nita: s.nita ?? 0, kitos: s.kitos ?? 0 },
  }
}

function parseHomeItem(id: string, x: Record<string, any>): HomeItem {
  const a = x.amount as Partial<Amount> | undefined
  const amount: Amount =
    a?.type === 'pctTotal' || a?.type === 'pctBase' ? { type: a.type, value: Number(a.value) || 0 } : { type: 'fixed', value: Number(a?.value) || 0 }
  const m = x.monthly as Partial<MonthlySchedule> | null | undefined
  return {
    id,
    title: x.title ?? '',
    category: (x.category ?? 'otros') as CategoryId,
    amount,
    monthly:
      m && typeof m.count === 'number' && typeof m.start === 'string'
        ? { count: m.count, day: m.day ?? 1, start: m.start, paidOverride: typeof m.paidOverride === 'number' ? m.paidOverride : null }
        : null,
    date: typeof x.date === 'string' ? x.date : null,
    paid: x.paid === true,
    countsTowardPrice: x.countsTowardPrice === true,
    income: x.income === true,
    notes: x.notes ?? '',
  }
}

/** Cada tarde a las 20:00: pagos de mañana y, el día 1, recordatorio de actualizar el ahorro. */
export const homeReminders = onSchedule({ schedule: '0 20 * * *', timeZone: 'Europe/Madrid' }, async () => {
  const cfg = parseHome((await db.doc('home/meroe').get()).data())
  if (!cfg) return
  const [itemsSnap, fundsSnap, prefs] = await Promise.all([db.collection('homeItems').get(), db.collection('homeFunds').get(), loadPrefs()])
  const items = itemsSnap.docs.map((d) => parseHomeItem(d.id, d.data()))
  const funds: Fund[] = fundsSnap.docs.map((d) => ({
    id: d.id,
    name: d.get('name') ?? '',
    owner: d.get('owner') ?? 'both',
    amount: Number(d.get('amount')) || 0,
    updatedAt: d.get('updatedAt') instanceof Timestamp ? (d.get('updatedAt') as Timestamp).toMillis() : null,
  }))
  for (const push of homePushes(items, funds, cfg, prefs, new Date())) await send(push)
})
