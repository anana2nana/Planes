# 💞 Nitakitos · Planes

App web móvil, privada y colaborativa en tiempo real para gestionar nuestros planes en pareja.

**Stack:** Vite + React 19 + TypeScript · Tailwind CSS v4 · Firebase (Auth con Google + Firestore en tiempo real) · Despliegue en Vercel.

## ✨ Qué hace

- **Tiempo real**: cualquier cambio aparece al instante en el móvil del otro (`onSnapshot`). Con caché offline: funciona sin conexión y sincroniza al volver.
- **Asignación flexible**: Nita (yo) · Kitos (él) · Nitakitos (ambos) · **Duplicar** (crea una copia independiente para cada uno; editar una actualiza las dos, pero cada uno la marca como hecha por su cuenta y ves el estado de la del otro).
- **Fechas tope y cuenta atrás en vivo**: los planes de los próximos 7 días muestran cuenta atrás al segundo; el más cercano sale destacado en grande. Agrupados en *Vencidos / Próximos 7 días / Más adelante / Sin fecha*.
- **Prioridades y etiquetas** con colores personalizables (paleta + selector libre) desde *Ajustes*, sincronizados para los dos.
- **Privada**: solo vuestros dos emails pueden entrar, garantizado por las reglas de Firestore (no solo por la UI).
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

### 2. Local

```bash
npm install
cp .env.example .env.local   # rellena las claves de Firebase y vuestros emails
npm run dev                   # http://localhost:5173
```

Para probarlo desde el móvil en la misma wifi: `npm run dev -- --host` y abre en Chrome la IP que aparezca (para *instalarla* hace falta HTTPS, así que eso ya con la URL de Vercel).

### 3. Despliegue en Vercel

1. En <https://vercel.com/new> importa este repo de GitHub. Detecta Vite solo (`npm run build`, salida `dist`).
2. En **Environment Variables** añade las mismas variables que en `.env.local` (todas las `VITE_…`, excepto `VITE_USE_EMULATORS`).
3. **Deploy**.
4. Vuelve a Firebase → **Authentication → Configuración → Dominios autorizados** → añade tu dominio de Vercel (`tu-app.vercel.app`). Sin esto el login con Google falla.
5. Instalarla en los Pixel: abre la URL en **Chrome** → menú ⋮ → **Instalar app** (o acepta el aviso "Instalar" que aparece abajo). Queda en el cajón de apps con su icono, se abre a pantalla completa sin barra del navegador, y si mantienes pulsado el icono tienes el atajo **Nuevo plan**.

## 🧪 Probar sin tocar Firebase real (opcional)

Con Java instalado puedes usar los emuladores locales:

```bash
npx firebase-tools emulators:start --only auth,firestore --project demo-nitakitos
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
firestore.rules           # 🔒 Acceso solo para vosotros dos + validación de datos
```

## 📐 Modelo de datos (Firestore)

| Colección | Campos |
|---|---|
| `plans/{id}` | `title, notes, assignee ('nita' \| 'kitos' \| 'both'), groupId (copias duplicadas), dueAt, allDay, priority, tagIds[], done, doneAt, doneBy, createdBy, createdAt, updatedAt` |
| `tags/{id}` | `name, color` |
| `config/priorities` | `{ urgent \| high \| medium \| low: { label, color } }` |
