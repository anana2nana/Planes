# Nitakitos · notas del proyecto (para Claude)

App web móvil privada para una pareja: **Nita** (la dueña del repo, poco técnica: explicar paso a paso, en español, sin jerga) y **Kitos**. Ambos usan **Android (Pixel 7 Pro y Pixel 9 Pro XL)** con la app instalada como PWA desde Chrome.

## Despliegue — leer antes de tocar nada

- **Producción**: Vercel publica automáticamente la rama por defecto de GitHub, que es **`claude/vigilant-volta-4eshsx`**. Si trabajas en otra rama, los cambios **no llegan** a la app hasta que se fusionen en esa. Avisa a Nita.
- URL: https://planes-inky.vercel.app · Proyecto Firebase: `planes-5af6b` (plan Blaze, Firestore en `eur3`, funciones en `europe-west1`).
- El repo es **privado** (y no hace falta ponerlo público: ver la clave de Cloud Shell más abajo).
- **Cloud Functions** (`functions/`) NO se despliegan solas. Nita lo hace desde Cloud Shell (https://shell.cloud.google.com/?project=planes-5af6b), donde ya tiene clonado el repo en `~/Planes`:
  ```
  cd Planes && git pull
  npx -y firebase-tools deploy --only functions,firestore:indexes --project planes-5af6b
  ```
  Si cambias `functions/` o `firestore.indexes.json`, díselo con estos comandos exactos.
- ⚠️ **Nunca** despliegues `firestore:rules` desde el repo: `firestore.rules` tiene emails de ejemplo (`nita@gmail.com`…) y dejaría a la pareja sin acceso. Las reglas reales (con sus emails) se pegan a mano en la consola de Firebase. Si cambias las reglas, dale a Nita el texto completo con sus emails para pegarlo.
- **Cloud Shell ya no necesita el repo público**: tiene una clave SSH de solo lectura (deploy key "Cloud Shell" en GitHub, `~/.ssh/planes`, host `github-planes` en `~/.ssh/config`). Si `git pull` falla por permisos, revisar eso antes de pedirle que lo haga público.
- **Copia de seguridad**: programada en Firestore (`gcloud firestore backups schedules`, semanal los domingos, 14 semanas). Restaurar = `gcloud firestore databases restore` a una base nueva.
- **No subas nunca sus emails reales al repo** (decisión de privacidad). Están solo en: reglas de la consola de Firebase, variables `VITE_NITA_EMAIL` / `VITE_KITOS_EMAIL` en Vercel y los parámetros `NITA_EMAIL` / `KITOS_EMAIL` de las funciones (`functions/.env.planes-5af6b`, solo en Cloud Shell).
- `.env.production` (sí está en el repo) lleva la config web pública de Firebase y la clave VAPID pública.

## Stack y estructura

Vite + React 19 + TypeScript + Tailwind v4 (`@tailwindcss/vite`) + Firebase 12 (Auth con Google, Firestore en tiempo real con caché persistente, Cloud Messaging) · Cloud Functions v2 (Node 22).

- **Estructura (oct 2026): 5 áreas generales** en la barra de abajo, pensadas para crecer como un "SAP de casa" (Nita lo quiere así; módulos nuevos = baldosa nueva en su área, no pestañas nuevas):
  - **Hoy** (`areas/HoyView`): `TodayStrip` (Hoy para ti, comida, recuerdos, "¿qué tal fue?") + tarjetas de cada área (compra, próximo pago MEROE, gata, regalo/aniversario cercano) + "Próximos días". Título: "Viernes 9 oct".
  - **Agenda** (`areas/AgendaView`): 📅 Calendario · 💞 Planes · 🧹 Tareas (recuerda el apartado; `rememberAgendaMode`); el + crea cita/plan/tarea según el apartado.
  - **Hogar** (`areas/HogarView`): MEROE (`home/HomeView`, con sus espacios), Compra, Notas, La gata; "Mantenimiento" próximamente.
  - **Bienestar** (`areas/BienestarView`): Menú, Recetas; Nutrición, Entrenos y Peso próximamente (siguiente paso acordado).
  - **Nosotros** (`areas/NosotrosView`): "juntos desde hace X años, meses, semanas y días" (`togetherBreakdown`), próximo aniversario, Diario, Algún día, Regalos; Viajes próximamente.
  - Cada área es una portada con baldosas (`hub/Tile`, `SoonTile`) y espacios con historial (`hooks/useSection`, clave = nombre del área en `history.state`). La cabecera muestra migas ("Hogar · MEROE") y botón atrás (`AreaTitleInfo`). Volver a tocar el área en la barra te lleva a su portada (`navKey`). Ajustes: tocando el avatar (con foto de perfil: `profiles/{persona}`, `useProfilePhotos`).
  - Pasar callbacks **estables** (useCallback) a `onTitle`: uno nuevo en cada render crea un bucle infinito.
- `src/App.tsx` — áreas, botón + (en Hoy y Agenda), hoja de edición (ocupa una entrada del historial para que el "atrás" de Android la cierre), `go(area, espacio)` para ir directo a un espacio.
- `src/lib/` — `types.ts`, `kinds.ts` (textos por tipo), `recurrence.ts` (repeticiones), `time.ts`, `people.ts`, `push.ts` (FCM), `firebase.ts`.
- `src/services/plans.ts` — todas las escrituras. No se espera a `commit()` en la UI (funciona offline).
- `src/components/` — `CalendarView` (Agenda), `PlansView` (listas de planes/tareas), `PlanForm`, `PlanCard`, `SettingsView`, `NotificationsSection`, `ErrorBoundary`…
- `public/sw.js` — service worker que muestra los push (mensajes solo de datos).
- `functions/src/` — `index.ts` (triggers y tareas programadas), `logic.ts` (qué avisar, puro y testeado), `homeAlerts.ts` (avisos de la casa), `euribor.ts`; `recurrence.ts`, `home.ts`, `pet.ts` y `gifts.ts` son **copias idénticas** de las de `src/lib/` (unos tests lo comprueban).
- Funciones programadas: `sendReminders` (cada 5 min), `dailyDigest` (cada hora; manda el resumen a quien lo tenga a esa hora, `digestHour` en `config/notifications`), `homeReminders` (20:00: pagos de MEROE de mañana; el día 1, recordatorio de actualizar el ahorro), `updateEuribor` (8:30).
- **Menú de la semana** (`food/MenuView`, `lib/menu.ts` testeado): colección `meals` con id `yyyy-mm-dd_comida|cena`; comida todos los días y cena solo el finde (entre semana, "+ cena"). Cada uno come `casa | taper | fuera` (martes y miércoles, táper los dos por defecto: Nita lleva táper esos días y Kitos también), `cook` nita/kitos/both (suele cocinar Nita o juntos). "Hacer de más para otros días" copia el plato. "Ingredientes a la compra" junta los de las recetas que quedan (sin cantidades: `ingredientName`; despensa desmarcada). Hoy para ti y el resumen de la mañana muestran la comida; `homeReminders` el domingo avisa si la semana siguiente tiene < 3 comidas.
- **Recetas ricas**: `lib/recipe.ts` (testeado: `splitQty`, `scaleQty`, `shoppingName`…) — grupos de ingredientes `{q, name}`, fases con pasos (título, texto, chips, `cue` "señal de que va bien", `fix` "si no está bien", `tech` "técnica al detalle", `timer`), consejos, utensilios, créditos. **Importar HTML** (`lib/recipeHtml.ts`, en el navegador con DOMParser): entiende el formato de las recetas de Nita (`ul.ing` con `.q`, `.phase`/`.step`, `.cue`/`.fix`, `details.tech`, `.timer[data-seconds]`, `.tips .card`, `.credit`), si no JSON-LD schema.org/Recipe, si no encabezados "Ingredientes"/"Preparación". Reimportar (mismo título) actualiza. El HTML original se guarda aparte en `recipeHtml/{id}` (≤ 700k) y se ve en un iframe con sandbox ("Original"). `RecipeCook` = modo cocina a pantalla completa (z-[45]: encima de la barra de abajo, debajo de las hojas): tachar ingredientes y marcar pasos (localStorage), raciones ± que reescalan cantidades, temporizadores con hora de fin + vibración + pitido, pantalla siempre encendida (Wake Lock). `RecipeEditor` edita todo (ingredientes por grupo como líneas "300 g harina"). Capas con historial: `hooks/useLayer` (el "atrás" cierra solo la de arriba).
- **Recetas** (`food/RecipesView`, colección `recipes`): enlace (sobre todo TikTok/Instagram de Diego Doal y Cocina con Carmen, que no tienen web con datos: no se puede importar solo), ingredientes y pasos; "Pegar la descripción del vídeo" los separa (`splitRecipeText`). Compartir un TikTok/YouTube sugiere "Receta".
- **Diario de recuerdos** (Planes → 📸 Diario; `memories/DiaryView`, `MemorySheet`, `hooks/useMemories`, `lib/memories.ts` testeado): colección `memories` (título, fecha, `md` "MM-DD" para "tal día como hoy", `kind`, `planId`, sitio, frase, `thumb` miniatura ~360px, `photoCount`, `by`) y `memoryPhotos` (una foto grande por documento, `memoryId` + `order`; se ordenan en el cliente para no necesitar índice). Al completar un **plan** siempre pregunta (App `onToggle` → `MemorySheet` con "Ahora no"); las **citas** pasadas (no repetidas o anuales, hasta 3 días) salen en Hoy para ti como "¿Qué tal fue…?" ("Ahora no" se guarda en localStorage); las **tareas** no preguntan, pero el formulario de cualquier plan tiene "📸 Añadir un recuerdo". "Tal día como hoy" en Hoy para ti, en el diario y en el resumen de la mañana (`onThisDayLine`).
- **Lista de la compra**: `shopping` (un doc por cosa) + `config/shopping.items` (lo que suelen comprar: veces y sección, para sugerencias). `ShoppingView`.
- Agenda: franja `TodayStrip` ("Hoy para ti", con "💞 N días juntos" y días especiales). Formulario de planes: "Guardar cambios" solo aparece si hay cambios (`dirty`).
- **Algún día** (en Planes, interruptor "Con fecha / Algún día"): colección `ideas` (`IdeasView`, `lib/ideas.ts`), ruleta "¿Qué hacemos hoy?"; "Ponerle fecha" abre el formulario relleno y al guardar marca la idea como hecha.
- **Aniversario**: `config/couple.since` (Ajustes → Nosotros). `lib/couple.ts`; el resumen de la mañana del servidor añade la línea del día especial.
- **Google Calendar**: función `calendarFeed` (HTTP pública, protegida por el token secreto de `config/calendar`; `?who=nita|kitos` filtra). Lógica pura en `functions/src/ics.ts`. Ajustes → Google Calendar crea/cambia el enlace. Solo las citas llevan RRULE (planes/tareas crean la siguiente al completarse).
- **Compartir con Nitakitos** (`share_target` en `public/manifest.webmanifest` → `/share?title&text&url`): `lib/share.ts` (`parseShared`, testeado) + `ShareSheet` (Algún día / Plan con fecha / Regalo / Compra / Nota). Si viene de Google Maps busca el sitio con `findPlace` (`lib/maps.ts`). Android solo actualiza el manifest de la app instalada cada cierto tiempo (o reinstalando).
- **Regalos secretos** (Planes → 🎁 Regalos): colección `gifts` con `owner`; **las reglas solo dejan leer/escribir las tuyas** (función `me()` de las reglas, por email) y la consulta filtra `where('owner','==',me)`. Ocasiones en `lib/gifts.ts` (copia idéntica en `functions/src/gifts.ts`): cumple de la pareja (`config/couple.birthdays` "MM-DD", Ajustes → Nosotros), aniversario, Reyes, San Valentín. `homeReminders` avisa 21 y 7 días antes, solo a quien regala y sin títulos (pantalla bloqueada). Preferencia `gifts`.
- **Regalos cifrados** (`lib/giftCrypto.ts` testeado, `hooks/useGifts.ts`, `GiftLock`): cada uno pone una contraseña (≥ 8 caracteres) → clave AES-GCM derivada con PBKDF2 (310k iteraciones, sal en `giftKeys/{persona}` junto a un `check` cifrado; nunca la clave). Título, enlace, precio y notas van en `enc`; en claro solo `owner`, `occasion`, `status` (los usa `homeReminders`) y `title: '🔒'`. La clave se guarda en el móvil (localStorage) tras escribirla una vez. Al crearla se cifran las ideas antiguas. Si se olvida: "empezar de cero" borra sus ideas. Ni la dueña del proyecto puede leerlas desde la consola.
- **Reparto de tareas** (arriba en Tareas): `lib/split.ts` cuenta tareas hechas por mes según `doneBy`; `TaskSplit` (barra partida con los colores de cada uno; en oscuro `--color-kitos` es algo más oscuro, validado con el skill dataviz).
- **Notas de casa** (Casa → En casa → Notas): colección `notes` (`useNotes`, `NotesView`), con plantillas (wifi, tallas, teléfonos) y botón Copiar.
- Tipo de letra Plus Jakarta Sans **dentro de la app** (`@fontsource-variable/plus-jakarta-sans`), sin llamadas a Google Fonts. Sin analítica ni rastreadores: no añadir ninguno.
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
- Otras colecciones: `tags`, `devices/{tokenFCM}`, `config/priorities`, `config/notifications`, `config/couple` (`since`, `birthdays`), `config/calendar`, `meals`, `recipes`, `recipeHtml`, `memories`, `memoryPhotos`, `ideas`, `receipts`, `pet`, `petCare`, `shopping`, `notes`, `gifts` (privada por persona y cifrada), `giftKeys`, `profiles`.

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
- `tsconfig.app.json` tiene `allowImportingTsExtensions`: en `src/lib/` los imports en tiempo de ejecución entre módulos llevan `.ts` (p. ej. `./recipe.ts`) para que los tests de Node (`--experimental-strip-types`) los encuentren.
- Las notificaciones push no se actualizan solas: nada de cuentas atrás en el texto ("Quedan 27 min" se queda viejo); poner la hora ("Hoy a las 19:00 (en 27 min)").

## Ideas pendientes

Hechas: Google Calendar, Algún día, presupuestos y tickets, gata, modo oscuro, aniversario, compartir, regalos, reparto, notas, menú y recetas, diario.

- **Fase 2 (acordada con Nita)**: ~~menú semanal~~ y ~~diario~~ (hechos); **viajes** (fechas, reservas, maleta reutilizable, presupuesto). Descartado: gastos compartidos tipo Splitwise (no hacen cuentas).
- **Siguiente (acordado)**: módulo **Salud** en Bienestar: peso corporal y medidas + entrenos (rutinas, series, kilos, última marca), para los dos (sobre todo Kitos). **Nutrición aproximada** enlazada al menú: calorías/nutrientes por receta y colores por plato (ligero/sano ↔ denso) para ver de un vistazo la semana. Google Fit no: sus APIs cierran y Health Connect no funciona en webs.
- E2E: `nav.mjs` (en el scratchpad) tiene `go(page, destino)` para la nueva navegación.

- MEROE está en la **Comunidad de Madrid**: AJD 0,75 % del precio sin IVA (anunciada rebaja al 0,4 % para menores de 40 desde 2027, pendiente de aprobar; no sabemos sus edades).
- La **reserva (5.000 €) no se descuenta del precio**: es un fondo; si sube el precio, la subida se cubre primero con él. En la app: `countsTowardPrice: false`.
- "12 meses de obra" = un único pago en julio de 2027 (lo meten ellos en la app).
