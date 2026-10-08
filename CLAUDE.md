# Nitakitos · notas del proyecto (para Claude)

App web móvil privada para una pareja: **Nita** (la dueña del repo, poco técnica: explicar paso a paso, en español, sin jerga) y **Kitos**. Ambos usan **Android (Pixel 7 Pro y Pixel 9 Pro XL)** con la app instalada como PWA desde Chrome.

## Despliegue — leer antes de tocar nada

- **Producción**: Vercel publica automáticamente la rama por defecto de GitHub, que es **`claude/vigilant-volta-4eshsx`**. Si trabajas en otra rama, los cambios **no llegan** a la app hasta que se fusionen en esa. Avisa a Nita.
- URL: https://planes-inky.vercel.app · Proyecto Firebase: `planes-5af6b` (plan Blaze, Firestore en `eur3`, funciones en `europe-west1`).
- El repo es **privado** (a veces Nita lo pone público un momento para hacer `git pull` desde Cloud Shell).
- **Cloud Functions** (`functions/`) NO se despliegan solas. Nita lo hace desde Cloud Shell (https://shell.cloud.google.com/?project=planes-5af6b), donde ya tiene clonado el repo en `~/Planes`:
  ```
  cd Planes && git pull
  npx -y firebase-tools deploy --only functions,firestore:indexes --project planes-5af6b
  ```
  Si cambias `functions/` o `firestore.indexes.json`, díselo con estos comandos exactos.
- ⚠️ **Nunca** despliegues `firestore:rules` desde el repo: `firestore.rules` tiene emails de ejemplo (`nita@gmail.com`…) y dejaría a la pareja sin acceso. Las reglas reales (con sus emails) se pegan a mano en la consola de Firebase. Si cambias las reglas, dale a Nita el texto completo con sus emails para pegarlo.
- **No subas nunca sus emails reales al repo** (decisión de privacidad). Están solo en: reglas de la consola de Firebase, variables `VITE_NITA_EMAIL` / `VITE_KITOS_EMAIL` en Vercel y los parámetros `NITA_EMAIL` / `KITOS_EMAIL` de las funciones (`functions/.env.planes-5af6b`, solo en Cloud Shell).
- `.env.production` (sí está en el repo) lleva la config web pública de Firebase y la clave VAPID pública.

## Stack y estructura

Vite + React 19 + TypeScript + Tailwind v4 (`@tailwindcss/vite`) + Firebase 12 (Auth con Google, Firestore en tiempo real con caché persistente, Cloud Messaging) · Cloud Functions v2 (Node 22).

- `src/App.tsx` — pestañas **Agenda / Planes / Tareas / Compra / Casa** (Ajustes: tocando el avatar de arriba), botón + (crea el tipo de la pestaña), hoja de edición (ocupa una entrada del historial para que el "atrás" de Android la cierre).
- `src/lib/` — `types.ts`, `kinds.ts` (textos por tipo), `recurrence.ts` (repeticiones), `time.ts`, `people.ts`, `push.ts` (FCM), `firebase.ts`.
- `src/services/plans.ts` — todas las escrituras. No se espera a `commit()` en la UI (funciona offline).
- `src/components/` — `CalendarView` (Agenda), `PlansView` (listas de planes/tareas), `PlanForm`, `PlanCard`, `SettingsView`, `NotificationsSection`, `ErrorBoundary`…
- `public/sw.js` — service worker que muestra los push (mensajes solo de datos).
- `functions/src/` — `index.ts` (triggers y tareas programadas), `logic.ts` (qué avisar, puro y testeado), `homeAlerts.ts` (avisos de la casa), `euribor.ts`; `recurrence.ts`, `home.ts` y `pet.ts` son **copias idénticas** de las de `src/lib/` (unos tests lo comprueban).
- Funciones programadas: `sendReminders` (cada 5 min), `dailyDigest` (cada hora; manda el resumen a quien lo tenga a esa hora, `digestHour` en `config/notifications`), `homeReminders` (20:00: pagos de MEROE de mañana; el día 1, recordatorio de actualizar el ahorro), `updateEuribor` (8:30).
- **Lista de la compra**: `shopping` (un doc por cosa) + `config/shopping.items` (lo que suelen comprar: veces y sección, para sugerencias). `ShoppingView`.
- Agenda: franja `TodayStrip` ("Hoy para ti", con "💞 N días juntos" y días especiales). Formulario de planes: "Guardar cambios" solo aparece si hay cambios (`dirty`).
- **Algún día** (en Planes, interruptor "Con fecha / Algún día"): colección `ideas` (`IdeasView`, `lib/ideas.ts`), ruleta "¿Qué hacemos hoy?"; "Ponerle fecha" abre el formulario relleno y al guardar marca la idea como hecha.
- **Aniversario**: `config/couple.since` (Ajustes → Nosotros). `lib/couple.ts`; el resumen de la mañana del servidor añade la línea del día especial.
- **Google Calendar**: función `calendarFeed` (HTTP pública, protegida por el token secreto de `config/calendar`; `?who=nita|kitos` filtra). Lógica pura en `functions/src/ics.ts`. Ajustes → Google Calendar crea/cambia el enlace. Solo las citas llevan RRULE (planes/tareas crean la siguiente al completarse).
- **Modo oscuro** automático (sigue al móvil): en `index.css` se redefinen `cream`, `surface`, `ink`, `muted`, `stone-*` y los tonos pastel 50/100/700. **Usa `bg-surface` (no `bg-white`) para tarjetas, y `text-cream` (no `text-white`) sobre `bg-ink`.** `bg-white/10-30` solo sobre degradados.

## Casa (cooperativa MEROE)

`src/components/home/` (portada `HomeView` → espacios Plan de pagos / Hipoteca / ¿Llegamos?, cada uno con entrada en el historial). Cálculos puros en `src/lib/home.ts` y `src/lib/mortgage.ts` (tests en `tests/`, con números inventados).
- `home/meroe`: precio sin IVA, IVA, mes de entrega (`handover`), condiciones de hipoteca, ahorro mensual de cada uno.
- `homeItems`: pagos/gastos/ingresos. Importe fijo o % del precio (`pctTotal` con IVA, `pctBase` sin IVA) → si sube el precio se recalcula. Cuotas mensuales: `monthly {count, day, start, paidOverride}`; se marcan pagadas solas al llegar su día (sin servidor), o con ajuste manual. `countsTowardPrice`: lo que queda del precio va a la entrega = hipoteca (% del precio sin IVA) + ahorros.
- Presupuestos por categoría: `home/meroe.budgets` (barra roja si se pasan). Tickets: colección `receipts` (`{itemId, data}` JPEG comprimido < 900k caracteres en el propio Firestore, `lib/image.ts`); se borran con su gasto.
- **La gata** (bloque "En casa" de la portada; accesible aunque MEROE no esté configurado): `pet/profile` (nombre, nacimiento, chip, veterinario, pesos) y `petCare` (cuidados cada N semanas/meses/años con `last` e `history`). `lib/pet.ts` (copia idéntica en `functions/src/pet.ts`). `homeReminders` avisa la víspera ("🐱 Mañana toca…") y cada 7 días si sigue pendiente; los cuidados sin "última vez" no avisan.
- `homeFunds`: dinero de cada uno (lo actualizan a mano). `rates/euribor`: Euríbor 12M del BCE con historial (Cloud Functions `updateEuribor` diaria y `refreshEuribor` a petición).
- **No subir los importes reales de la pareja al repo** (precio, ahorros, ayudas familiares): los meten ellos en la app.

## Google Maps

`src/lib/maps.ts` + `PlaceField`: Places API (New) para sugerencias, mini mapa (Maps JS + `DEMO_MAP_ID`) y enlace de ruta `google.com/maps/dir`. Clave `VITE_GOOGLE_MAPS_API_KEY` en `.env.production` (pública; restringida a planes-inky.vercel.app y localhost:5173). Desde este entorno Google Maps SÍ responde (se puede probar de verdad en localhost:5173).

## Modelo de datos (colección `plans`)

Un documento por elemento, con `kind`: `event` (cita: no se completa), `plan` (ocio) o `task` (casa, gata, gimnasio). Sin `kind` = `plan` (datos antiguos).
- `assignee`: `nita` | `kitos` | `both`. "Duplicar" = dos documentos con el mismo `groupId`.
- `repeat`: `{ days[] (0=domingo), yearly, rotate }`. Planes/tareas: al completar se crea el siguiente documento (`spawnedFrom`); con `rotate` (turnos) el siguiente es para la otra persona. Citas: no se completan; la función `sendReminders` las mueve a su siguiente fecha cuando pasan.
- Citas de todo el día: avisos referidos a las 9:00. `remindWeekBefore`: aviso extra 7 días antes.
- Otras colecciones: `tags`, `devices/{tokenFCM}`, `config/priorities`, `config/notifications`, `config/couple`, `config/calendar`, `ideas`, `receipts`, `pet`, `petCare`, `shopping`.

## Cómo probar (en este entorno)

- `npm run build` (incluye `tsc`) · `npm test` (cálculos de la app en `tests/` + tests de las funciones, con `TZ=Europe/Madrid`).
- E2E: emuladores de Auth+Firestore (`firebase-tools emulators:start --only auth,firestore --project demo-nitakitos`) + `vite` con un `.env.local` de demo y `VITE_USE_EMULATORS=true`. El popup de Google no carga aquí: iniciar sesión con `signInWithCredential(GoogleAuthProvider.credential(JSON.stringify({sub,email,email_verified:true})))` importando los módulos desde el dev server. Usa perfiles de Playwright de Pixel con `timezoneId: 'Europe/Madrid'` y ejecuta node con `TZ=Europe/Madrid`.
- El emulador de Functions no arranca aquí (el CLI usa el proxy para 127.0.0.1): ejecutar los handlers compilados con `.run(event)` contra el emulador de Firestore.
- Borra `.env.local` y para los procesos al terminar.

## Errores ya encontrados (no repetir)

- En Chrome reciente `window.scrollTo()` devuelve una promesa: nunca `useEffect(() => window.scrollTo(...))` sin llaves (React la toma como limpieza → "l is not a function").
- `pkill -f vite` mata también tu propia shell: busca PIDs con `ps` + `awk`, y nunca en el mismo comando que arranca esos procesos (el texto del comando también coincide).
- En español `Intl.NumberFormat` no separa miles con 4 cifras ("1214 €"): usar `useGrouping: 'always'`.
- No hacer `git add -f` de archivos `.env` (lo bloquea la política de permisos).
- En la PWA de Android, un enlace https a Google Maps se abre en una pestaña de Chrome, no en la app: usar el enlace `intent://…;package=com.google.android.apps.maps` (`navigationHref` en `lib/maps.ts`, componente `DirectionsLink`).
- En dev, `.env.production` no se carga: copia también `VITE_GOOGLE_MAPS_API_KEY` al `.env.local` de demo o las pruebas de Maps fallan.
- Los textos con clase `uppercase` salen en mayúsculas en `innerText`: compáralos sin distinguir mayúsculas en los tests.
- Las notificaciones push no se actualizan solas: nada de cuentas atrás en el texto ("Quedan 27 min" se queda viejo); poner la hora ("Hoy a las 19:00 (en 27 min)").

## Ideas pendientes

Hechas: Google Calendar, Algún día, presupuestos y tickets, gata, modo oscuro, aniversario.

- MEROE está en la **Comunidad de Madrid**: AJD 0,75 % del precio sin IVA (anunciada rebaja al 0,4 % para menores de 40 desde 2027, pendiente de aprobar; no sabemos sus edades).
- La **reserva (5.000 €) no se descuenta del precio**: es un fondo; si sube el precio, la subida se cubre primero con él. En la app: `countsTowardPrice: false`.
- "12 meses de obra" = un único pago; falta saber la fecha.
