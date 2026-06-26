# Tablero de Respuesta · VE

> Tablero vivo de **coordinación de tareas** para que una organización (ONG, iglesia, red de voluntarios) y la ciudadanía respondan juntos a un desastre, sin caos y sin exponer a nadie.
> Modelo: la organización **publica y supervisa** tareas; los voluntarios **toman** las que pueden hacer.

**En vivo:** https://tablero-respuesta-ve.web.app

Diseño de *centro de mando* — serio, moderno y futurista, con la bandera de Venezuela como identidad.

---

## Qué es

Una **PWA en tiempo real** con tres actores:

| Actor | Qué hace |
|---|---|
| 🧭 **Coordinador** | Crea, prioriza y supervisa tareas. Ve todo: tablero, voluntarios, mapa táctico y bandeja de reportes. |
| 🙋 **Voluntario** | Ve las tareas abiertas ordenadas por prioridad → cercanía → habilidad, y toma / inicia / completa / suelta. |
| 📢 **Reportante** | Sin cuenta: avisa de una necesidad que el coordinador convierte en tarea. |

El **ciclo de vida de la tarea** (`Abierta → Tomada → En curso → Completada`, con soltar y cancelar) es el corazón del sistema. El tablero se sincroniza **en vivo entre todos los dispositivos** vía Firestore `onSnapshot` — abre la URL en dos ventanas y verás los cambios reflejarse al instante.

## Stack

- **Next.js 14** (App Router, export estático) — `src/app`
- **Firebase Firestore** — backend en tiempo real (`onSnapshot`), offline-first nativo (`persistentLocalCache` / IndexedDB)
- **Firebase Hosting** — despliegue actual en vivo
- **GitHub** — código fuente
- **Vercel** — despliegue alternativo (ver abajo)

## Estructura

```
src/
  lib/
    firebase.js   inicialización del SDK web + Firestore con caché persistente
    model.js      zonas, habilidades, prioridades, helpers puros
    store.js      capa de datos: suscripciones en vivo, mutaciones (transacciones), semilla
  app/
    layout.js     metadata PWA
    globals.css   sistema de diseño (centro de mando + tricolor de Venezuela)
    page.js       app principal: 3 flujos, toasts, modal, toggle de red
    components/   Flag, TaskCard, TacticalMap
public/           manifest.webmanifest, icons/
firestore.rules   reglas de seguridad
```

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # config pública de Firebase (ya incluida como fallback)
npm run dev                  # http://localhost:3000
```

La primera carga **siembra** Firestore con datos de demo (8 tareas, 2 reportes, 4 voluntarios) si está vacío.

## Despliegue

### Firebase Hosting (actual)
```bash
npm run build                       # genera ./out (export estático)
firebase deploy --only hosting
```

### Vercel
```bash
vercel login        # autenticar una vez
vercel deploy --prod
```
O conectar el repo de GitHub en el dashboard de Vercel para auto-deploy en cada push.

## Notas de seguridad (importante)

Este es un **prototipo en modo demo** sobre el plan gratuito (Spark) de Firebase:

- Las reglas de Firestore están **abiertas** (`allow read, write: if true`) para funcionar en vivo sin provisionar Firebase Auth (Identity Platform requiere billing).
- La identidad del voluntario es un `uid` persistente del lado del cliente (`localStorage`).

**Para producción:** habilitar **verificación por teléfono (SMS)** con Firebase Auth y endurecer las reglas a `allow write: if request.auth != null` con permisos por rol. La especificación funcional completa está en `Tablero-Respuesta-VE-Spec.md`.

---

*Borrador para validación. Accios Core — Panamá.*
