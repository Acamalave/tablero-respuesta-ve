/* ---------------------------------------------------------------
   Modelo de dominio — zonas, habilidades, prioridades y helpers
   puros compartidos por toda la app.
   --------------------------------------------------------------- */

export const ZONES = {
  caracas:   { name: 'Caracas',    sector: 'Distrito Capital', x: 70, y: 56 },
  laguaira:  { name: 'La Guaira',  sector: 'Litoral central',  x: 60, y: 26 },
  sanfelipe: { name: 'San Felipe', sector: 'Yaracuy',          x: 24, y: 50 },
  yumare:    { name: 'Yumare',     sector: 'Yaracuy norte',    x: 34, y: 22 },
  valencia:  { name: 'Valencia',   sector: 'Carabobo',         x: 48, y: 60 },
};
export const ZONE_KEYS = Object.keys(ZONES);

export function dist(a, b) {
  const za = ZONES[a], zb = ZONES[b];
  if (!za || !zb) return 999;
  return Math.hypot(za.x - zb.x, za.y - zb.y);
}

// Habilidades / recursos que una persona puede ofrecer, en sintonía con la
// respuesta a un terremoto (rescate fuera de alcance; aquí: acción y apoyo).
export const SKILLS = {
  vehiculo:       { label: 'Vehículo',               icon: '🚙' },
  traslado:       { label: 'Traslado de personas',   icon: '🚐' },
  fuerza:         { label: 'Fuerza física',          icon: '💪' },
  construccion:   { label: 'Construcción / escombros', icon: '🔨' },
  electricidad:   { label: 'Electricidad',           icon: '⚡' },
  agua:           { label: 'Agua y saneamiento',     icon: '🚰' },
  cocina:         { label: 'Cocina',                 icon: '🍳' },
  donaciones:     { label: 'Donaciones',             icon: '🎁' },
  primeros:       { label: 'Primeros auxilios',      icon: '🩹' },
  medico:         { label: 'Atención médica',        icon: '🏥' },
  psicologico:    { label: 'Apoyo emocional',        icon: '🧠' },
  cuidado:        { label: 'Cuidado de personas',    icon: '👶' },
  mascotas:       { label: 'Rescate / cuidado de mascotas', icon: '🐾' },
  comunicaciones: { label: 'Comunicaciones',         icon: '📡' },
  refugio:        { label: 'Refugio / alojamiento',  icon: '🏠' },
  logistica:      { label: 'Logística',              icon: '📦' },
};

export const PRIOS = {
  alta:  { label: 'Alta',  color: 'var(--p-alta)',  led: '#ff3b5c', bg: 'var(--p-alta-bg)' },
  media: { label: 'Media', color: 'var(--p-media)', led: '#ffb01f', bg: 'var(--p-media-bg)' },
  baja:  { label: 'Baja',  color: 'var(--p-baja)',  led: '#28d3a7', bg: 'var(--p-baja-bg)' },
};
export const PRIO_ORDER = { alta: 0, media: 1, baja: 2 };

export const COORD_CONTACT = 'Coord. Cáritas · +58 412-0000000';

/* ----- helpers de tiempo / estado ----- */
export function ago(ts) {
  if (!ts) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

// Estado global derivado de los cupos de la tarea
export function taskState(t) {
  if (t.status === 'cancelada') return 'cancelada';
  const taken = t.takenBy || [];
  const active = taken.filter((x) => x.state !== 'completada');
  const filled = taken.filter((x) => x.state === 'completada').length;
  if (filled >= t.need) return 'completada';
  if (active.length === 0) return 'abierta';
  if (active.some((x) => x.state === 'curso')) return 'curso';
  return 'tomada';
}

export function takenCount(t) {
  return (t.takenBy || []).filter((x) => x.state !== 'completada' && x.state !== 'soltada').length;
}

export function avatarFor(name = '') {
  const e = ['🧑‍🚒', '👩‍⚕️', '🧑‍🍳', '🧑‍🔧', '👷', '🧑‍🌾', '🧑‍✈️', '👨‍🔬'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % e.length;
  return e[h];
}

export function prioBg(p) {
  return p === 'alta' ? 'var(--p-alta-bg)' : p === 'media' ? 'var(--p-media-bg)' : 'var(--p-baja-bg)';
}
