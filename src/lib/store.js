'use client';
/* ---------------------------------------------------------------
   Capa de datos — Firestore en tiempo real.
   El tablero se sincroniza en vivo entre coordinador y voluntarios
   vía onSnapshot. Offline-first nativo (persistentLocalCache).
   --------------------------------------------------------------- */
import { db, auth } from './firebase';
import { signInAnonymously } from 'firebase/auth';
import {
  collection, doc, onSnapshot, runTransaction, updateDoc, setDoc,
  getDocsFromServer, query, writeBatch, enableNetwork, disableNetwork, increment,
} from 'firebase/firestore';

const TASKS = collection(db, 'tasks');
const REPORTS = collection(db, 'reports');
const VOLS = collection(db, 'volunteers');

/* ----- Identidad ----- */
// uid persistente del lado del cliente (sobrevive recargas). En producción
// se reemplaza por el uid de Firebase Auth (teléfono/SMS).
const UID_KEY = 'tablero_uid_v1';
export function clientUid() {
  if (typeof window === 'undefined') return 'srv';
  let u = localStorage.getItem(UID_KEY);
  if (!u) { u = 'u-' + Math.random().toString(36).slice(2, 12); localStorage.setItem(UID_KEY, u); }
  return u;
}

// Intento oportunista de auth anónima (si algún día se habilita). No bloquea.
export function tryAnonAuth() {
  try { signInAnonymously(auth).catch(() => {}); } catch {}
}

/* ----- Suscripciones en vivo ----- */
const snap = (ref, cb) =>
  onSnapshot(ref, { includeMetadataChanges: true }, (s) => {
    const rows = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(rows, { fromCache: s.metadata.fromCache });
  }, () => cb([], { fromCache: true }));

export const subTasks = (cb) => snap(TASKS, cb);
export const subReports = (cb) => snap(REPORTS, cb);
export const subVolunteers = (cb) => snap(VOLS, cb);

/* ----- Red (demo offline-first) ----- */
export const goOffline = () => disableNetwork(db);
export const goOnline = () => enableNetwork(db);

/* ----- Mutaciones de tareas ----- */
export async function createTask(data) {
  const ref = doc(TASKS);
  await setDoc(ref, {
    title: data.title,
    prio: data.prio || 'media',
    zone: data.zone || 'caracas',
    loc: data.loc || '',
    need: Math.max(1, parseInt(data.need) || 1),
    skill: data.skill || null,
    created: Date.now(),
    takenBy: [],
    status: 'activa',
  });
  return ref.id;
}

// Toma un cupo de forma segura (transacción) — resuelve la carrera por el último cupo.
export async function takeTask(taskId, volunteer) {
  const ref = doc(TASKS, taskId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) throw new Error('no-existe');
    const t = s.data();
    const taken = (t.takenBy || []).filter((x) => x.state !== 'completada' && x.state !== 'soltada');
    if (taken.length >= t.need) throw new Error('cupo-lleno');
    if ((t.takenBy || []).some((x) => x.uid === volunteer.uid && x.state !== 'completada' && x.state !== 'soltada'))
      return 'ya-tomada';
    tx.update(ref, { takenBy: [...(t.takenBy || []), { name: volunteer.name, uid: volunteer.uid, state: 'tomada' }] });
    return 'ok';
  });
}

async function mutateMine(taskId, uid, fn) {
  const ref = doc(TASKS, taskId);
  return runTransaction(db, async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists()) return;
    const t = s.data();
    const next = (t.takenBy || []).map((x) =>
      x.uid === uid && x.state !== 'completada' && x.state !== 'soltada' ? fn(x) : x
    );
    tx.update(ref, { takenBy: next });
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
    const next = (t.takenBy || []).filter((x) => !(x.uid === uid && x.state !== 'completada'));
    tx.update(ref, { takenBy: next });
  });
}

const ORDER = ['alta', 'media', 'baja'];
export const cyclePrio = (taskId, current) =>
  updateDoc(doc(TASKS, taskId), { prio: ORDER[(ORDER.indexOf(current) + 1) % 3] });

export const cancelTask = (taskId) => updateDoc(doc(TASKS, taskId), { status: 'cancelada' });

/* ----- Voluntarios ----- */
// Perfil unificado del usuario (vale para voluntario y/o reportante).
export async function upsertVolunteer(v) {
  const data = { name: v.name, zone: v.zone || null, skills: v.skills || [], phone: v.phone || '', cedula: v.cedula || '' };
  // done/reports solo se escriben en el registro; no se pisan al recargar/sincronizar.
  if (typeof v.done === 'number') data.done = v.done;
  if (typeof v.reports === 'number') data.reports = v.reports;
  await setDoc(doc(VOLS, v.uid), data, { merge: true });
}
export const bumpVolunteerDone = (uid) =>
  updateDoc(doc(VOLS, uid), { done: increment(1) }).catch(() => {});
export const bumpReports = (uid) =>
  updateDoc(doc(VOLS, uid), { reports: increment(1) }).catch(() => {});

/* ----- Reportes ----- */
export async function createReport(data) {
  const ref = doc(REPORTS);
  await setDoc(ref, {
    need: data.need,
    loc: data.loc || 'Sin ubicación precisa',
    zone: data.zone || 'caracas',
    note: data.note || '',
    reporterUid: data.uid || null,
    reporterName: data.reporterName || '',
    reporterPhone: data.reporterPhone || '',
    reporterCedula: data.reporterCedula || '',
    created: Date.now(),
    status: 'pendiente',
  });
  return ref.id;
}
export const setReportStatus = (id, status) => updateDoc(doc(REPORTS, id), { status });

/* ----- Semilla (solo si está vacío) ----- */
export async function seedIfEmpty() {
  // Consulta el SERVIDOR (no la caché local) para no resembrar sobre datos viejos.
  let existing;
  try { existing = await getDocsFromServer(query(TASKS)); } catch { return false; }
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
  tasks.forEach(({ id, ...t }) => batch.set(doc(TASKS, id), { ...t, status: 'activa' }));

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
