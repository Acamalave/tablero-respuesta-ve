'use client';
/* Mapa de la región (tono claro) — tareas activas por zona (SVG, sin deps) */
import { ZONES, ZONE_KEYS, taskState } from '@/lib/model';

export default function TacticalMap({ tasks }) {
  const cy = (z) => ZONES[z].y * 0.62 + 6;

  const nodes = ZONE_KEYS.map((z) => {
    const zt = tasks.filter((t) => t.zone === z && ['abierta', 'tomada', 'curso'].includes(taskState(t)));
    const Z = ZONES[z];
    if (!zt.length) {
      return (
        <g key={z}>
          <circle cx={Z.x} cy={cy(z)} r="1.6" fill="#c3ccdb" />
          <text x={Z.x} y={cy(z) - 3.2} fill="#aab4c4" fontSize="2.6" fontFamily="IBM Plex Sans, sans-serif" textAnchor="middle">{Z.name}</text>
        </g>
      );
    }
    const hasAlta = zt.some((t) => t.prio === 'alta');
    const open = zt.some((t) => taskState(t) === 'abierta');
    const col = hasAlta ? '#e11d48' : open ? '#0d9a6c' : '#d97706';
    return (
      <g key={z}>
        <circle cx={Z.x} cy={cy(z)} r={4 + zt.length} fill={col} opacity="0.12" />
        <circle cx={Z.x} cy={cy(z)} r="2.6" fill={col} />
        <circle cx={Z.x} cy={cy(z)} r="2.6" fill="none" stroke={col} opacity="0.5">
          <animate attributeName="r" values="2.6;7;2.6" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.55;0;0.55" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <text x={Z.x} y={cy(z) - 4.2} fill="#182030" fontSize="3" fontWeight="700" fontFamily="Chivo, sans-serif" textAnchor="middle">{Z.name}</text>
        <text x={Z.x} y={cy(z) + 7} fill={col} fontSize="2.7" fontWeight="700" fontFamily="IBM Plex Sans, sans-serif" textAnchor="middle">{zt.length} {zt.length === 1 ? 'tarea' : 'tareas'}</text>
      </g>
    );
  });

  return (
    <div className="panel mapwrap">
      <svg className="region-map" viewBox="0 0 100 58" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa de tareas por zona">
        <defs>
          <pattern id="gridbig" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" fill="none" stroke="#e6ecf5" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100" height="58" fill="url(#gridbig)" />
        {nodes}
        <text x="50" y="55" fill="#aab4c4" fontSize="2.4" fontFamily="IBM Plex Sans, sans-serif" textAnchor="middle">Región norte-central · tareas geolocalizadas en vivo</text>
      </svg>
      <div className="maplegend">
        <span className="it"><span className="led" style={{ background: '#e11d48' }} />Prioridad alta</span>
        <span className="it"><span className="led" style={{ background: '#0d9a6c' }} />Tareas abiertas</span>
        <span className="it"><span className="led" style={{ background: '#d97706' }} />Todo en curso</span>
      </div>
    </div>
  );
}
