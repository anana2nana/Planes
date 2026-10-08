import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveKey, exportKey, importKey, makeCheck, open, randomSalt, seal, verify } from '../src/lib/giftCrypto.ts'

test('regalos cifrados: con la contraseña buena se lee, con otra no', async () => {
  const salt = randomSalt()
  const key = await deriveKey('mi frase secreta', salt, 1000)
  const sealed = await seal(key, { title: 'Zapatillas de trail', price: 89 })
  assert.ok(!sealed.includes('Zapatillas'))
  assert.deepEqual(await open(key, sealed), { title: 'Zapatillas de trail', price: 89 })
  const check = await makeCheck(key)
  assert.equal(await verify(key, check), true)
  const wrong = await deriveKey('otra frase', salt, 1000)
  assert.equal(await verify(wrong, check), false)
  await assert.rejects(open(wrong, sealed))
  // La clave guardada en el móvil sirve igual.
  const again = await importKey(await exportKey(key))
  assert.equal((await open<{ title: string }>(again, sealed)).title, 'Zapatillas de trail')
  // Misma contraseña y misma sal → misma clave (en otro móvil).
  const other = await deriveKey('mi frase secreta', salt, 1000)
  assert.equal(await verify(other, check), true)
})
