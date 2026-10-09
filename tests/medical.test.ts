import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isMedical } from '../src/lib/medical.ts'

test('médico: reconoce las citas médicas de la agenda', () => {
  for (const t of ['Dentista', 'Médico de cabecera', 'Cita con la Dra. López', 'Ginecóloga', 'Análisis de sangre', 'Vacuna de la gripe', 'Fisio', 'Revisión médica empresa', 'Oftalmólogo']) assert.ok(isMedical({ title: t }), t)
  for (const t of ['Cumple de Ana', 'Cena con amigos', 'ITV', 'Revisión de la caldera', 'Dramático']) assert.ok(!isMedical({ title: t }), t)
  assert.ok(isMedical({ title: 'Dr. House', health: false }))
  assert.ok(isMedical({ title: 'Ir a por los resultados', health: true }))
})
