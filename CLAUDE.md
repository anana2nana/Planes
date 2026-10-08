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

- `src/App.tsx` — pestañas **Agenda / Planes / Tareas / Casa** (Ajustes: tocando el avatar de arriba), botón + (crea el tipo de la pestaña), hoja de edición (ocupa una entrada del historial para que el "atrás" de Android la cierre).
- `src/lib/` — `types.ts`, `kinds.ts` (textos por tipo), `recurrence.ts` (repeticiones), `time.ts`, `people.ts`, `push.ts` (FCM), `firebase.ts`.
- `src/services/plans.ts` — todas las escrituras. No se espera a `commit()` en la UI (funciona offline).
- `src/components/` — `CalendarView` (Agenda), `PlansView` (listas de planes/tareas), `PlanForm`, `PlanCard`, `SettingsView`, `NotificationsSection`, `ErrorBoundary`…
- `public/sw.js` — service worker que muestra los push (mensajes solo de datos).
- `functions/src/` — `index.ts` (triggers), `logic.ts` (qué avisar, puro y testeado), `recurrence.ts` (**copia idéntica** de `src/lib/recurrence.ts`; un test lo comprueba).

## Casa (cooperativa MEROE)

`src/components/home/` (portada `HomeView` → espacios Plan de pagos / Hipoteca / ¿Llegamos?, cada uno con entrada en el historial). Cálculos puros en `src/lib/home.ts` y `src/lib/mortgage.ts` (tests en `tests/`, con números inventados).
- `home/meroe`: precio sin IVA, IVA, mes de entrega (`handover`), condiciones de hipoteca, ahorro mensual de cada uno.
- `homeItems`: pagos/gastos/ingresos. Importe fijo o % del precio (`pctTotal` con IVA, `pctBase` sin IVA) → si sube el precio se recalcula. Cuotas mensuales: `monthly {count, day, start, paidOverride}`; se marcan pagadas solas al llegar su día (sin servidor), o con ajuste manual. `countsTowardPrice`: lo que queda del precio va a la entrega = hipoteca (% del precio sin IVA) + ahorros.
- `homeFunds`: dinero de cada uno (lo actualizan a mano). `rates/euribor`: Euríbor 12M del BCE con historial (Cloud Functions `updateEuribor` diaria y `refreshEuribor` a petición).
- **No subir los importes reales de la pareja al repo** (precio, ahorros, ayudas familiares): los meten ellos en la app.

## Google Maps

`src/lib/maps.ts` + `PlaceField`: Places API (New) para sugerencias, mini mapa (Maps JS + `DEMO_MAP_ID`) y enlace de ruta `google.com/maps/dir`. Clave `VITE_GOOGLE_MAPS_API_KEY` en `.env.production` (pública; restringida a planes-inky.vercel.app y localhost:5173). Desde este entorno Google Maps SÍ responde (se puede probar de verdad en localhost:5173).

## Modelo de datos (colección `plans`)

Un documento por elemento, con `kind`: `event` (cita: no se completa), `plan` (ocio) o `task` (casa, gata, gimnasio). Sin `kind` = `plan` (datos antiguos).
- `assignee`: `nita` | `kitos` | `both`. "Duplicar" = dos documentos con el mismo `groupId`.
- `repeat`: `{ days[] (0=domingo), yearly, rotate }`. Planes/tareas: al completar se crea el siguiente documento (`spawnedFrom`); con `rotate` (turnos) el siguiente es para la otra persona. Citas: no se completan; la función `sendReminders` las mueve a su siguiente fecha cuando pasan.
- Citas de todo el día: avisos referidos a las 9:00. `remindWeekBefore`: aviso extra 7 días antes.
- Otras colecciones: `tags`, `devices/{tokenFCM}`, `config/priorities`, `config/notifications`.

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
- Las notificaciones push no se actualizan solas: nada de cuentas atrás en el texto ("Quedan 27 min" se queda viejo); poner la hora ("Hoy a las 19:00 (en 27 min)").

## Ideas pendientes

- Muebles: presupuesto por categoría con barra (ahora solo pagado/previsto) y fotos de tickets.
- Aviso push el día antes de cada cuota de la cooperativa.
- Confirmar con Nita: ¿la reserva (5.000 €) se descuenta del precio? ¿AJD de su comunidad? ("12 meses de obra" = un único pago; falta saber la fecha).
