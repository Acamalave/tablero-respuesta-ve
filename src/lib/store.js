'use client';
/* ---------------------------------------------------------------
   Capa de datos — Firestore OPTIMIZADO PARA COSTO.
   Reglas aplicadas (ver Optimizacion-Costos-Firestore.md):
   #1 Sin onSnapshot sobre colecciones → lecturas bajo demanda (getDocs).
   #2 Caché local persistente (offline-first) activada en firebase.js.
   #3 limit() + paginación (startAfter).
   #4 Filtros con where() en el servidor (no en el cliente).
   #5 Resúmenes con agregación count() → ~1 lectura por conteo, no N.
   #6 Un documento por tarea con campos denormalizados para consultar barato.
   --------------------------------------------------------------- */
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import {
  collection, doc, onSnapshot, runTransaction, updateDoc, setDoc, getDoc,
  getDocs, getDocsFromServer, getCountFromServer, query, where, orderBy,
  limit, startAfter, writeBatch, enableNetwork, disableNetwork, increment,
} from 'firebase/firestore';

const TASKS = collection(db, 'tasks');
const REPORTS = collection(db, 'reports');
const VOLS = collection(db, 'volunteers');
const VISITS = collection(db, 'visits');           // personas únicas que ingresaron
const SUGGESTIONS = collection(db, 'suggestions');  // sugerencias de usuarios al coordinador
const ANNOUNCEMENTS = collection(db, 'announcements'); // tarjetas de información (difundir)
const DONATIONS = collection(db, 'donations');      // aportes registrados
const COORD_DOC = doc(db, 'config', 'coordinator');
const DON_DOC = doc(db, 'config', 'donations');     // datos de pago para aportes

export const PAGE = 20; // tamaño de página del tablero

/* ----- Identidad ----- */
const UID_KEY = 'tablero_uid_v1';
export function clientUid() {
  if (typeof window === 'undefined') return 'srv';
  let u = localStorage.getItem(UID_KEY);
  if (!u) { u = 'u-' + Math.random().toString(36).slice(2, 12); localStorage.setItem(UID_KEY, u); }
  return u;
}
// Adopta un uid existente (recuperar perfil por cédula en otro dispositivo).
export function setClientUid(u) {
  try { if (typeof window !== 'undefined' && u) localStorage.setItem(UID_KEY, u); } catch {}
}
// Cédula normalizada (solo dígitos) — clave para evitar perfiles repetidos.
export const normCedula = (c) => (c || '').replace(/\D/g, '');
// Busca un perfil existente por cédula. Devuelve el perfil o null.
export async function findByCedula(cedula) {
  const n = normCedula(cedula);
  if (n.length < 6) return null;
  try {
    const snap = await getDocs(query(VOLS, where('cedulaNorm', '==', n), limit(1)));
    return snap.empty ? null : row(snap.docs[0]);
  } catch { return null; }
}
export function tryAnonAuth() {
  try { signInAnonymously(auth).catch(() => {}); } catch {}
}

/* ----- Red (demo offline-first) ----- */
export const goOffline = () => disableNetwork(db);
export const goOnline = () => enableNetwork(db);

/* ----- Denormalización (regla #4/#6): campos que permiten consultar barato.
   state: abierta|tomada|curso|completada|cancelada
   active: true si la tarea sigue en el tablero (abierta/tomada/curso)
   takerUids: uids que participan (para "Mis tareas" con array-contains) ----- */
function denorm(t) {
  const taken = t.takenBy || [];
  let state;
  if (t.status === 'cancelada') state = 'cancelada';
  else {
    const active = taken.filter((x) => x.state !== 'completada');
    const filled = taken.length - active.length;
    if (filled >= t.need) state = 'completada';
    else if (active.length === 0) state = 'abierta';
    else if (active.some((x) => x.state === 'curso')) state = 'curso';
    else state = 'tomada';
  }
  const active = state === 'abierta' || state === 'tomada' || state === 'curso';
  const takerUids = [...new Set(taken.map((x) => x.uid).filter(Boolean))];
  return { state, active, takerUids };
}
const row = (d) => ({ id: d.id, ...d.data() });

/* ============================================================
   LECTURAS BAJO DEMANDA (regla #1, #3, #4)
   ============================================================ */

// Tablero: solo tareas activas, ordenadas y paginadas (no toda la colección).
export async function fetchBoard(after = null) {
  const base = [where('active', '==', true), orderBy('created', 'desc')];
  const q = after
    ? query(TASKS, ...base, startAfter(after), limit(PAGE))
    : query(TASKS, ...base, limit(PAGE));
  const snap = await getDocs(q);
  const docs = snap.docs;
  return { rows: docs.map(row), last: docs[docs.length - 1] || null, more: docs.length === PAGE };
}

// EXCEPCIÓN permitida (regla #1): listener en tiempo real sobre UN SOLO
// documento (la tarea en foco/abierta). Nunca sobre el tablero completo.
export const subTask = (id, cb) =>
  onSnapshot(doc(TASKS, id), (s) => cb(s.exists() ? row(s) : null), () => cb(null));

// Tiempo real de UN reporte (para mostrar al ciudadano si ya fue evaluado).
export const subReport = (id, cb) =>
  onSnapshot(doc(REPORTS, id), (s) => cb(s.exists() ? row(s) : null), () => cb(null));

// "Mis tareas": solo las del usuario (array-contains) — no escanea el tablero.
export async function fetchMyTasks(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(TASKS, where('takerUids', 'array-contains', uid), limit(10)));
  return snap.docs.map(row);
}

// Bandeja del coordinador: solo reportes pendientes.
export async function fetchPendingReports() {
  const snap = await getDocs(query(REPORTS, where('status', '==', 'pendiente'), orderBy('created', 'desc'), limit(40)));
  return snap.docs.map(row);
}
// Reportes de un usuario.
export async function fetchMyReports(uid) {
  if (!uid) return [];
  const snap = await getDocs(query(REPORTS, where('reporterUid', '==', uid), orderBy('created', 'desc'), limit(20)));
  return snap.docs.map(row);
}
export async function fetchVolunteers() {
  const snap = await getDocs(query(VOLS, limit(200)));
  return snap.docs.map(row);
}
export async function fetchUser(uid) {
  if (!uid) return null;
  const s = await getDoc(doc(VOLS, uid));
  return s.exists() ? row(s) : null;
}

// Conteo REAL de voluntarios registrados (agregación count → ~1 lectura).
export async function fetchHelpersCount() {
  try { return (await getCountFromServer(VOLS)).data().count; } catch { return 0; }
}

// Historial de tareas de UN voluntario (para la vista previa del coordinador).
export async function fetchVolunteerTasks(uid) {
  if (!uid) return [];
  try {
    const snap = await getDocs(query(TASKS, where('takerUids', 'array-contains', uid), limit(25)));
    return snap.docs.map(row).sort((a, b) => (b.created || 0) - (a.created || 0));
  } catch { return []; }
}

/* ----- Visitas (personas únicas que ingresaron) ----- */
// Se registra UNA vez por navegador (gated por localStorage en el cliente).
export async function recordVisit(uid) {
  if (!uid) return;
  try { await setDoc(doc(VISITS, uid), { firstSeen: Date.now() }); } catch {}
}
export async function fetchVisits(max = 100) {
  try { const s = await getDocs(query(VISITS, orderBy('firstSeen', 'desc'), limit(max))); return s.docs.map(row); }
  catch { return []; }
}
export async function fetchVisitsCount() {
  try { return (await getCountFromServer(VISITS)).data().count; } catch { return 0; }
}

/* ----- Sugerencias (usuario → coordinador) ----- */
export async function createSuggestion(data) {
  const ref = doc(SUGGESTIONS);
  await setDoc(ref, {
    text: data.text, name: data.name || '', uid: data.uid || null,
    created: Date.now(), status: 'nueva',
  });
  return ref.id;
}
export async function fetchSuggestions(max = 60) {
  try { const s = await getDocs(query(SUGGESTIONS, orderBy('created', 'desc'), limit(max))); return s.docs.map(row); }
  catch { return []; }
}
export const setSuggestionStatus = (id, status) => updateDoc(doc(SUGGESTIONS, id), { status }).catch(() => {});

/* ----- Información para difundir (tarjetas del coordinador) ----- */
export async function createAnnouncement(text) {
  const ref = doc(ANNOUNCEMENTS);
  await setDoc(ref, { text, created: Date.now(), active: true });
  return ref.id;
}
export async function fetchAnnouncements(max = 20) {
  try {
    const s = await getDocs(query(ANNOUNCEMENTS, where('active', '==', true), limit(max)));
    return s.docs.map(row).sort((a, b) => (b.created || 0) - (a.created || 0));
  } catch { return []; }
}
export const updateAnnouncement = (id, text) => updateDoc(doc(ANNOUNCEMENTS, id), { text }).catch(() => {});
// "Quitar" = ocultar (soft-delete) para no borrar de verdad.
export const hideAnnouncement = (id) => updateDoc(doc(ANNOUNCEMENTS, id), { active: false }).catch(() => {});

/* ----- Aportes / donaciones ----- */
// Datos de pago (editables por el coordinador): pago móvil, Bancamiga, PagueloFácil.
export async function fetchDonationConfig() {
  try { const s = await getDoc(DON_DOC); return s.exists() ? s.data() : null; } catch { return null; }
}
export async function saveDonationConfig(c) {
  await setDoc(DON_DOC, {
    pmPhone: c.pmPhone || '', pmId: c.pmId || '', pmBank: c.pmBank || '',
    bankAccount: c.bankAccount || '', bankHolder: c.bankHolder || '', bankId: c.bankId || '', bankType: c.bankType || '',
    pfLink: c.pfLink || '', cardEnabled: !!c.cardEnabled,
  }, { merge: true });
}
// Crea un cobro con tarjeta en PagueloFácil (vía Cloud Function) y devuelve la
// URL de checkout de un solo uso. La verificación del pago la hace el backend.
export async function createCardPayment({ amount, uid, name }) {
  const r = await fetch('/pf/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, donorUid: uid || '', donorName: name || '' }),
  });
  if (!r.ok) throw new Error('No se pudo iniciar el pago');
  const j = await r.json();
  if (!j.url) throw new Error('Respuesta inválida de la pasarela');
  return j.url;
}
// Registrar un aporte (autoinformado por el donante).
export async function createDonation(data) {
  const ref = doc(DONATIONS);
  await setDoc(ref, {
    donorUid: data.uid || null, donorName: data.name || '',
    method: data.method || '', amount: data.amount || '', reference: data.reference || '',
    created: Date.now(),
  });
  return ref.id;
}
export async function fetchMyDonations(uid) {
  if (!uid) return [];
  try {
    const s = await getDocs(query(DONATIONS, where('donorUid', '==', uid), limit(40)));
    return s.docs.map(row).sort((a, b) => (b.created || 0) - (a.created || 0));
  } catch { return []; }
}
export async function fetchDonationsCount() {
  try { return (await getCountFromServer(DONATIONS)).data().count; } catch { return 0; }
}
export async function fetchDonations(max = 60) {
  try { const s = await getDocs(query(DONATIONS, limit(max))); return s.docs.map(row).sort((a, b) => (b.created || 0) - (a.created || 0)); }
  catch { return []; }
}

// Contacto del coordinador (editable) — mostrado a los voluntarios.
export async function fetchCoordContact() {
  try { const s = await getDoc(COORD_DOC); return s.exists() ? s.data() : null; } catch { return null; }
}
export async function saveCoordContact(c) {
  await setDoc(COORD_DOC, { name: c.name || '', phone: c.phone || '' }, { merge: true });
}

// Resumen del coordinador con agregación count() (regla #5): ~1 lectura/conteo.
export async function fetchStats() {
  const cTasks = async (...cs) => (await getCountFromServer(query(TASKS, ...cs))).data().count;
  const [abiertas, tomadas, curso, completadas, pend] = await Promise.all([
    cTasks(where('state', '==', 'abierta')),
    cTasks(where('state', '==', 'tomada')),
    cTasks(where('state', '==', 'curso')),
    cTasks(where('state', '==', 'completada')),
    (async () => (await getCountFromServer(query(REPORTS, where('status', '==', 'pendiente')))).data().count)(),
  ]);
  return { abiertas, encurso: tomadas + curso, completadas, pend };
}

/* ============================================================
   MUTACIONES (escriben también los campos denormalizados)
   ============================================================ */
export async function createTask(data) {
  const ref = doc(TASKS);
  const base = {
    title: data.title, prio: data.prio || 'media', zone: data.zone || 'caracas', loc: data.loc || '',
    need: Math.max(1, parseInt(data.need) || 1), skill: data.skill || null,
    reporterName: data.reporterName || '', reporterPhone: data.reporterPhone || '',
    created: Date.now(), takenBy: [], status: 'activa',
  };
  await setDoc(ref, { ...base, ...denorm(base) });
  return ref.id;
}

// Editar una tarea publicada (coordinador): título, prioridad, zona, lugar,
// cupos y recurso. Recalcula los campos denormalizados (need afecta el estado).
export async function updateTask(id, data) {
  const ref = doc(TASKS, id);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const t = s.data();
    const merged = {
      ...t,
      title: data.title, prio: data.prio || 'media', zone: data.zone || 'caracas', loc: data.loc || '',
      need: Math.max(1, parseInt(data.need) || 1), skill: data.skill || null,
    };
    tx.update(ref, {
      title: merged.title, prio: merged.prio, zone: merged.zone, loc: merged.loc, need: merged.need, skill: merged.skill,
      ...denorm(merged),
    });
  });
}

export async function takeTask(taskId, volunteer) {
  const ref = doc(TASKS, taskId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('no-existe');
    const t = s.data();
    const taken = (t.takenBy || []).filter((x) => x.state !== 'completada' && x.state !== 'soltada');
    if (taken.length >= t.need) throw new Error('cupo-lleno');
    if ((t.takenBy || []).some((x) => x.uid === volunteer.uid && x.state !== 'completada' && x.state !== 'soltada')) return 'ya-tomada';
    const takenBy = [...(t.takenBy || []), { name: volunteer.name, uid: volunteer.uid, state: 'tomada' }];
    tx.update(ref, { takenBy, ...denorm({ ...t, takenBy }) });
    return 'ok';
  });
}

async function mutateMine(taskId, uid, fn) {
  const ref = doc(TASKS, taskId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const t = s.data();
    const takenBy = (t.takenBy || []).map((x) =>
      x.uid === uid && x.state !== 'completada' && x.state !== 'soltada' ? fn(x) : x);
    tx.update(ref, { takenBy, ...denorm({ ...t, takenBy }) });
  });
}
export const startTask = (taskId, uid) => mutateMine(taskId, uid, (x) => ({ ...x, state: 'curso' }));
export const completeTask = (taskId, uid) => mutateMine(taskId, uid, (x) => ({ ...x, state: 'completada' }));

export async function releaseTask(taskId, uid) {
  const ref = doc(TASKS, taskId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const t = s.data();
    const takenBy = (t.takenBy || []).filter((x) => !(x.uid === uid && x.state !== 'completada'));
    tx.update(ref, { takenBy, ...denorm({ ...t, takenBy }) });
  });
}

const ORDER = ['alta', 'media', 'baja'];
export const cyclePrio = (taskId, current) =>
  updateDoc(doc(TASKS, taskId), { prio: ORDER[(ORDER.indexOf(current) + 1) % 3] });

export const cancelTask = (taskId) =>
  updateDoc(doc(TASKS, taskId), { status: 'cancelada', state: 'cancelada', active: false });

/* ----- Perfil unificado ----- */
export async function upsertVolunteer(v) {
  const data = { name: v.name, zone: v.zone || null, skills: v.skills || [], phone: v.phone || '', cedula: v.cedula || '', cedulaNorm: normCedula(v.cedula) };
  if (typeof v.done === 'number') data.done = v.done;
  if (typeof v.reports === 'number') data.reports = v.reports;
  if (typeof v.createdAt === 'number') data.createdAt = v.createdAt; // solo al crear (registro)
  await setDoc(doc(VOLS, v.uid), data, { merge: true });
}
export const bumpVolunteerDone = (uid) => updateDoc(doc(VOLS, uid), { done: increment(1) }).catch(() => {});
export const bumpReports = (uid) => updateDoc(doc(VOLS, uid), { reports: increment(1) }).catch(() => {});

/* ----- Reportes ----- */
export async function createReport(data) {
  const ref = doc(REPORTS);
  await setDoc(ref, {
    need: data.need, loc: data.loc || 'Sin ubicación precisa', zone: data.zone || 'caracas',
    lat: data.lat ?? null, lng: data.lng ?? null, note: data.note || '',
    reporterUid: data.uid || null, reporterName: data.reporterName || '',
    reporterPhone: data.reporterPhone || '', reporterCedula: data.reporterCedula || '',
    created: Date.now(), status: 'pendiente',
  });
  return ref.id;
}
export const setReportStatus = (id, status) => updateDoc(doc(REPORTS, id), { status });

/* ----- Semilla (solo si está vacío; consulta el servidor) ----- */
export async function seedIfEmpty() {
  let existing;
  try { existing = await getDocsFromServer(query(TASKS, limit(1))); } catch { return false; }
  if (!existing.empty) return false;
  const now = Date.now(), min = 60 * 1000;
  const batch = writeBatch(db);

  const tasks = [
    { id: 'seed-t1', title: 'Repartir agua', prio: 'alta', zone: 'sanfelipe', loc: 'Refugio Esc. Bolívar, San Felipe', need: 3, skill: 'vehiculo', created: now - 15 * min, takenBy: [{ name: 'Jesús R.', uid: 'seed-v2', state: 'tomada' }] },
    { id: 'seed-t2', title: 'Despejar acceso vial', prio: 'alta', zone: 'yumare', loc: 'Vía principal, Yumare', need: 5, skill: 'fuerza', created: now - 40 * min, takenBy: [] },
    { id: 'seed-t3', title: 'Cocinar 50 platos', prio: 'media', zone: 'laguaira', loc: 'Refugio La Guaira', need: 4, skill: 'cocina', created: now - 70 * min, takenBy: [{ name: 'María G.', uid: 'seed-v1', state: 'curso' }, { name: 'Ana T.', uid: 'seed-x', state: 'curso' }] },
    { id: 'seed-t4', title: 'Censo de familias en refugio', prio: 'media', zone: 'caracas', loc: 'Liceo Andrés Bello, Caracas', need: 2, skill: 'logistica', created: now - 95 * min, takenBy: [] },
    { id: 'seed-t5', title: 'Trasladar medicinas', prio: 'alta', zone: 'caracas', loc: 'Farmacia Central → Refugio Sur', need: 1, skill: 'vehiculo', created: now - 8 * min, takenBy: [] },
    { id: 'seed-t6', title: 'Acompañar a adultos mayores', prio: 'baja', zone: 'sanfelipe', loc: 'Refugio Esc. Bolívar', need: 3, skill: 'primeros', created: now - 130 * min, takenBy: [] },
    { id: 'seed-t7', title: 'Clasificar donaciones', prio: 'baja', zone: 'valencia', loc: 'Galpón Cruz Roja, Valencia', need: 4, skill: 'logistica', created: now - 180 * min, takenBy: [{ name: 'Luis M.', uid: 'seed-v4', state: 'tomada' }] },
    { id: 'seed-t8', title: 'Reparto de colchonetas', prio: 'media', zone: 'yumare', loc: 'Cancha techada, Yumare', need: 2, skill: 'fuerza', created: now - 50 * min, takenBy: [] },
  ];
  tasks.forEach(({ id, ...t }) => { const base = { ...t, status: 'activa' }; batch.set(doc(TASKS, id), { ...base, ...denorm(base) }); });

  const vols = [
    { uid: 'seed-v1', name: 'María G.', zone: 'sanfelipe', skills: ['cocina', 'logistica'], done: 4 },
    { uid: 'seed-v2', name: 'Jesús R.', zone: 'yumare', skills: ['vehiculo', 'fuerza'], done: 6 },
    { uid: 'seed-v3', name: 'Andrea P.', zone: 'laguaira', skills: ['primeros'], done: 2 },
    { uid: 'seed-v4', name: 'Luis M.', zone: 'caracas', skills: ['vehiculo', 'logistica'], done: 3 },
  ];
  vols.forEach((v) => batch.set(doc(VOLS, v.uid), { name: v.name, zone: v.zone, skills: v.skills, done: v.done }));

  const reports = [
    { id: 'seed-r1', need: 'Falta agua potable', loc: 'Sector La Pastora, Caracas', zone: 'caracas', note: 'Unas 30 familias sin acceso desde anoche.', created: now - 22 * min, status: 'pendiente' },
    { id: 'seed-r2', need: 'Hay escombros bloqueando una casa', loc: 'Calle 8, San Felipe', zone: 'sanfelipe', note: '', created: now - 12 * min, status: 'pendiente' },
  ];
  reports.forEach(({ id, ...r }) => batch.set(doc(REPORTS, id), r));

  await batch.commit();
  return true;
}
