/* ---------------------------------------------------------------
   Modelo de dominio — zonas, habilidades, prioridades y helpers
   puros compartidos por toda la app.
   --------------------------------------------------------------- */

export const ZONES = {
  caracas:   { name: 'Caracas',    sector: 'Distrito Capital', x: 70, y: 56, lat: 10.4806, lng: -66.9036 },
  laguaira:  { name: 'La Guaira',  sector: 'Litoral central',  x: 60, y: 26, lat: 10.6000, lng: -66.9333 },
  sanfelipe: { name: 'San Felipe', sector: 'Yaracuy',          x: 24, y: 50, lat: 10.3399, lng: -68.7406 },
  yumare:    { name: 'Yumare',     sector: 'Yaracuy norte',    x: 34, y: 22, lat: 10.6126, lng: -68.6906 },
  valencia:  { name: 'Valencia',   sector: 'Carabobo',         x: 48, y: 60, lat: 10.1620, lng: -68.0077 },
};
export const ZONE_KEYS = Object.keys(ZONES);

// distancia abstracta sobre el lienzo (fallback de orden cuando no hay GPS)
export function dist(a, b) {
  const za = ZONES[a], zb = ZONES[b];
  if (!za || !zb) return 999;
  return Math.hypot(za.x - zb.x, za.y - zb.y);
}

// distancia real en km entre dos coordenadas (Haversine)
export function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
// km entre la posición del usuario {lat,lng} y la zona de una tarea
export function kmTo(pos, zone) {
  const Z = ZONES[zone];
  if (!pos || !Z) return null;
  return haversineKm(pos.lat, pos.lng, Z.lat, Z.lng);
}
export function fmtKm(km) {
  if (km == null) return null;
  if (km < 1) return 'menos de 1 km';
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
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
  inspecciones:   { label: 'Realizar inspecciones',  icon: '📋' },
  logistica:      { label: 'Logística',              icon: '📦' },
};

export const PRIOS = {
  alta:  { label: 'Alta',  color: 'var(--p-alta)',  led: '#ff3b5c', bg: 'var(--p-alta-bg)' },
  media: { label: 'Media', color: 'var(--p-media)', led: '#ffb01f', bg: 'var(--p-media-bg)' },
  baja:  { label: 'Baja',  color: 'var(--p-baja)',  led: '#28d3a7', bg: 'var(--p-baja-bg)' },
};
export const PRIO_ORDER = { alta: 0, media: 1, baja: 2 };

export const COORD_NAME = 'Coord. Cáritas';
// Teléfono del coordinador (placeholder — cámbialo por el real de la organización).
export const COORD_PHONE = '+58 412 0000000';

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
