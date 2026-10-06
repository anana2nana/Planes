# 💞 Nitakitos · Planes

App web móvil, privada y colaborativa en tiempo real para gestionar nuestros planes en pareja.

**Stack:** Vite + React 19 + TypeScript · Tailwind CSS v4 · Firebase (Auth con Google + Firestore en tiempo real + Cloud Functions + Cloud Messaging) · Despliegue en Vercel.

## ✨ Qué hace

- **Tiempo real**: cualquier cambio aparece al instante en el móvil del otro (`onSnapshot`). Con caché offline: funciona sin conexión y sincroniza al volver.
- **Asignación flexible**: Nita (yo) · Kitos (él) · Nitakitos (ambos) · **Duplicar** (crea una copia independiente para cada uno; editar una actualiza las dos, pero cada uno la marca como hecha por su cuenta y ves el estado de la del otro).
- **Fechas tope y cuenta atrás en vivo**: los planes de los próximos 7 días muestran cuenta atrás al segundo; el más cercano sale destacado en grande. Agrupados en *Vencidos / Próximos 7 días / Más adelante / Sin fecha*.
- **Agenda conjunta con tres tipos**: 📅 *Citas* (médico, cumpleaños: no se completan; los cumpleaños se repiten cada año y pueden avisar una semana antes), 💞 *Planes* (ocio) y 🧹 *Tareas* (casa, la gata, el gimnasio). La pestaña Agenda muestra todo en el calendario y las próximas citas; Planes y Tareas tienen su propia lista.
- **Turnos** en tareas repetidas: cada vez que se completa, la siguiente le toca a la otra persona.
- **Planes que se repiten** ciertos días de la semana (p. ej. martes y sábados, entre semana, todos los días). Al completar uno aparece el siguiente; si estaba vencido, salta al próximo día que toque sin acumular atrasos.
- **Calendario** mensual: puntos de color por persona en cada día, repeticiones futuras en tono suave, y al tocar un día ves sus planes o añades uno nuevo con esa fecha.
- **Prioridades y etiquetas** con colores personalizables (paleta + selector libre) desde *Ajustes*, sincronizados para los dos.
- **Privada**: solo vuestros dos emails pueden entrar, garantizado por las reglas de Firestore (no solo por la UI).
- **Notificaciones push** (también con la app cerrada):
  - cuando el otro te asigna un plan, crea uno para los dos o completa algo;
  - recordatorios antes de la fecha tope (a la hora, 15 min, 1 h, 3 h, 1 día: cada uno elige los suyos en *Ajustes*);
  - si la app está abierta delante, no se avisa de la actividad (ya se ve en vivo); los recordatorios siempre llegan.
- **Pensada para Android (Pixel)**: se instala como app desde Chrome con icono adaptable, el gesto/botón *atrás* cierra el formulario en vez de salir, el teclado no tapa los campos, vibración al completar y acceso directo **Nuevo plan** manteniendo pulsado el icono.

## 🚀 Puesta en marcha (≈10 min)

### 1. Firebase

1. Ve a <https://console.firebase.google.com> → **Crear proyecto** (puedes desactivar Analytics).
2. **Authentication** → *Comenzar* → *Método de acceso* → activa **Google**.
3. **Firestore Database** → *Crear base de datos* → modo **producción** → región `eur3 (europe-west)`.
4. **Configuración del proyecto** (⚙️) → *Tus apps* → icono **Web `</>`** → registra la app y copia los valores de `firebaseConfig`.
5. Edita `firestore.rules` y pon **vuestros dos emails** de Google en la lista. Luego publícalas, de una de estas formas:
   - Consola: *Firestore → Reglas* → pega el contenido del archivo → **Publicar**.
   - CLI: `npx firebase-tools login` y `npx firebase-tools deploy --only firestore:rules --project TU_PROJECT_ID`.

### 2. Notificaciones push

Las envían unas Cloud Functions (`functions/`): una salta cuando cambia un plan y otra revisa cada 5 minutos si toca algún recordatorio.

1. **Plan Blaze**: las Cloud Functions lo requieren (*Firebase → ⚙️ → Uso y facturación → Cambiar plan*). Pide tarjeta, pero para dos personas el uso queda muy por debajo de la capa gratuita (≈8.600 ejecuciones/mes de 2 millones gratis). Recomendado: crea una **alerta de presupuesto** de 1 € en ese mismo panel.
2. **Clave VAPID**: *⚙️ Configuración del proyecto → Cloud Messaging → Configuración web → Certificados push web → Generar par de claves*. Copia la clave en `VITE_FIREBASE_VAPID_KEY`.
3. **Desplegar** las funciones y el índice (te pedirá vuestros dos emails la primera vez y los guarda en `functions/.env.<proyecto>`). No incluyas `firestore:rules` salvo que `firestore.rules` tenga ya vuestros emails, o sobrescribirá las reglas publicadas:

   ```bash
   npm --prefix functions install
   npx firebase-tools login
   npx firebase-tools deploy --only functions,firestore:indexes --project TU_PROJECT_ID
   ```

4. En cada móvil: *Ajustes → Notificaciones → Activar* → permitir → **Enviarme una notificación de prueba**.

> Si no llegan: *Ajustes de Android → Apps → Nitakitos → Notificaciones* debe estar activado, y conviene poner la batería de la app en *Sin restricciones* para que los recordatorios no se retrasen.

### 3. Local

```bash
npm install
cp .env.example .env.local   # rellena las claves de Firebase y vuestros emails
npm run dev                   # http://localhost:5173
```

Para probarlo desde el móvil en la misma wifi: `npm run dev -- --host` y abre en Chrome la IP que aparezca (para *instalarla* hace falta HTTPS, así que eso ya con la URL de Vercel).

### 4. Despliegue en Vercel

1. En <https://vercel.com/new> importa este repo de GitHub. Detecta Vite solo (`npm run build`, salida `dist`).
2. En **Environment Variables** añade las mismas variables que en `.env.local` (todas las `VITE_…`, excepto `VITE_USE_EMULATORS`).
3. **Deploy**.
4. Vuelve a Firebase → **Authentication → Configuración → Dominios autorizados** → añade tu dominio de Vercel (`tu-app.vercel.app`). Sin esto el login con Google falla.
5. Instalarla en los Pixel: abre la URL en **Chrome** → menú ⋮ → **Instalar app** (o acepta el aviso "Instalar" que aparece abajo). Queda en el cajón de apps con su icono, se abre a pantalla completa sin barra del navegador, y si mantienes pulsado el icono tienes el atajo **Nuevo plan**.

## 🧪 Probar sin tocar Firebase real (opcional)

Lógica de notificaciones: `npm --prefix functions test`.

Con Java instalado puedes usar los emuladores locales (en el emulador las funciones escriben los avisos en el log en vez de enviarlos):

```bash
npx firebase-tools emulators:start --only auth,firestore,functions --project demo-nitakitos
# en .env.local: VITE_FIREBASE_PROJECT_ID=demo-nitakitos y VITE_USE_EMULATORS=true
npm run dev
```

## 🗂 Estructura

```
src/
  App.tsx                 # Shell: auth → Home (pestañas, botón +, hoja de edición, avisos)
  lib/
    firebase.ts           # Inicialización + caché offline persistente (+ emuladores)
    people.ts             # Nita / Kitos / Nitakitos / Duplicar y email → persona
    time.ts               # Cuenta atrás, urgencia, formato de fechas
    colors.ts             # Paleta, prioridades por defecto, contraste
    types.ts
  hooks/
    useAuth.ts            # Sesión + comprobación de acceso
    useCollections.ts     # Planes, etiquetas y prioridades en tiempo real
    useNow.ts             # Un único reloj compartido para todas las cuentas atrás
  services/plans.ts       # Escrituras (crear/duplicar/editar/completar/borrar, etiquetas, prioridades)
  components/             # PlanCard, NextUp, Countdown, PlanForm, Pickers, SettingsView…
  lib/push.ts             # Activar/desactivar push en este móvil (token FCM)
public/sw.js              # Service worker: muestra las notificaciones con la app cerrada
functions/src/
  index.ts                # Cloud Functions: avisos de actividad, recordatorios (cada 5 min), prueba
  logic.ts                # Qué avisar, a quién y cuándo (con tests en logic.test.ts)
firestore.rules           # 🔒 Acceso solo para vosotros dos + validación de datos
```

## 📐 Modelo de datos (Firestore)

| Colección | Campos |
|---|---|
| `plans/{id}` | `kind ('event' \| 'plan' \| 'task'; sin campo = plan), remindWeekBefore, title, notes, assignee ('nita' \| 'kitos' \| 'both'), groupId (copias duplicadas), repeat { days[] (0 = domingo), yearly, rotate }, seriesId, spawnedFrom, dueAt, allDay, priority, tagIds[], done, doneAt, doneBy, createdBy, createdAt, updatedAt, remindersSent[] (lo gestiona el servidor)` |
| `tags/{id}` | `name, color` |
| `config/priorities` | `{ urgent \| high \| medium \| low: { label, color } }` |
| `config/notifications` | `{ nita \| kitos: { activity, reminders, leads[] } }` |
| `devices/{token}` | `token, person, userAgent, updatedAt` (un documento por móvil con push activado) |
