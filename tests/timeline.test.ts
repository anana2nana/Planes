import { test } from 'node:test'
import assert from 'node:assert/strict'
import { timelineItems, type TimelineSources } from '../src/lib/timeline.ts'

const today = new Date(2026, 9, 9)
const empty: TimelineSources = { trips: [], papers: [], subs: [], upkeep: [], petCare: [], petName: 'Mía', health: [], capsules: [] }

test('calendario: todo lo que tiene fecha en los módulos', () => {
  const src: TimelineSources = {
    ...empty,
    trips: [{ id: 't', title: 'Lisboa', start: '2026-10-19', end: '2026-10-21' }],
    papers: [{ id: 'p', title: 'DNI', kind: 'documento', owner: 'nita', expires: '2026-10-29' }],
    subs: [
      { id: 's', name: 'Prime', price: 49.9, period: 'year', from: '2025-10-16', active: true, remind: false },
      { id: 'n', name: 'Netflix', price: 13.99, period: 'month', from: '2026-09-11', active: true, remind: false },
      { id: 'q', name: 'Gimnasio', price: 90, period: 'quarter', from: '2026-08-15', active: true, remind: false },
    ],
    upkeep: [{ id: 'u', title: 'Revisión de la caldera', every: { n: 1, unit: 'year' }, last: '2025-10-20', area: 'casa' }],
    petCare: [{ id: 'c', title: 'Pipeta', every: { n: 1, unit: 'month' }, last: '2026-09-01' }],
    health: [{ id: 'h', title: 'Dentista', kind: 'revision', date: '2025-10-25', next: '2026-10-25' }],
    capsules: [
      { id: 'a', from: 'kitos', to: 'nita', openAt: '2026-10-30', title: '' },
      { id: 'b', from: 'nita', to: 'kitos', openAt: '2026-10-31', title: 'Para ti' },
    ],
  }
  const items = timelineItems(src, 'nita', '2026-10-01', '2026-11-30', today)
  assert.deepEqual(
    items.map((i) => `${i.date} ${i.emoji} ${i.title} · ${i.detail}`),
    [
      '2026-10-09 🐱 Pipeta · Mía · pendiente',
      '2026-10-16 💳 Se cobra Prime · 49,90 €',
      '2026-10-19 ✈️ Lisboa · Salida',
      '2026-10-20 ✈️ Lisboa · Día 2 del viaje',
      '2026-10-20 🧰 Revisión de la caldera · Mantenimiento',
      '2026-10-21 ✈️ Lisboa · Vuelta',
      '2026-10-25 🦷 Dentista (próxima) · Médico · solo tú',
      '2026-10-29 🪪 Caduca: DNI de Nita · Papeles',
      '2026-10-30 💌 Carta de Kitos · Ya se puede abrir',
      '2026-10-31 📬 Se abre tu carta: Para ti · Cápsula del tiempo',
      '2026-11-15 💳 Se cobra Gimnasio · 90,00 €',
    ].map((s) => s.replace(' €', ' €')),
  )
  assert.equal(items[0].section, 'gata')
  // Kitos ve su carta como «para abrir» y la de Nita como suya.
  assert.deepEqual(
    timelineItems(src, 'kitos', '2026-10-01', '2026-11-30', today)
      .filter((i) => i.section === 'capsula')
      .map((i) => i.title),
    ['Se abre tu carta', 'Carta de Nita'],
  )
})

test('calendario: cobros que se repiten en el rango', () => {
  const src: TimelineSources = { ...empty, subs: [{ id: 'm', name: 'Spotify', price: 17.99, period: 'month', from: '2026-01-31', active: true, remind: true }] }
  assert.deepEqual(
    timelineItems(src, 'nita', '2026-10-01', '2027-01-31', today).map((i) => i.date),
    ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31'],
  )
})
