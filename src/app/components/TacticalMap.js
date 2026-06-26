'use client';
/* Mapa táctico tipo radar — tareas activas por zona (SVG, sin deps) */
import { ZONES, ZONE_KEYS, taskState } from '@/lib/model';

export default function TacticalMap({ tasks }) {
  const rings = [18, 32, 46].map((r) => (
    <circle key={r} cx="50" cy="40" r={r} fill="none" stroke="rgba(120,150,220,.10)" />
  ));

  const nodes = ZONE_KEYS.map((z) => {
    const zt = tasks.filter((t) => t.zone === z && ['abierta', 'tomada', 'curso'].includes(taskState(t)));
    if (!zt.length) return null;
    const hasAlta = zt.some((t) => t.prio === 'alta');
    const open = zt.some((t) => taskState(t) === 'abierta');
    const col = hasAlta ? '#ff3b5c' : open ? '#28d3a7' : '#ffb01f';
    const Z = ZONES[z];
    const cy = Z.y * 0.7;
    return (
      <g key={z}>
        <circle cx={Z.x} cy={cy} r={4 + zt.length} fill={col} opacity="0.14" />
        <circle cx={Z.x} cy={cy} r="2.4" fill={col} />
        <circle cx={Z.x} cy={cy} r="2.4" fill="none" stroke={col} opacity=".5">
          <animate attributeName="r" values="2.4;7;2.4" dur="2.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".6;0;.6" dur="2.6s" repeatCount="indefinite" />
        </circle>
        <text x={Z.x} y={cy - 4} fill="#eef2fb" fontSize="2.6" fontFamily="IBM Plex Mono, monospace" textAnchor="middle">{Z.name}</text>
        <text x={Z.x} y={cy + 6.5} fill={col} fontSize="2.4" fontFamily="IBM Plex Mono, monospace" textAnchor="middle" fontWeight="600">{zt.length} {zt.length === 1 ? 'tarea' : 'tareas'}</text>
      </g>
    );
  });

  return (
    <div className="panel mapwrap">
      <svg className="tac-map" viewBox="0 0 100 56" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa táctico de tareas por zona">
        {rings}
        <line x1="50" y1="2" x2="50" y2="68" stroke="rgba(120,150,220,.08)" />
        <line x1="4" y1="40" x2="96" y2="40" stroke="rgba(120,150,220,.08)" />
        {nodes}
        <text x="50" y="53" fill="#5e6f93" fontSize="2.2" fontFamily="IBM Plex Mono, monospace" textAnchor="middle" letterSpacing="0.3">REGIÓN NORTE-CENTRAL · TAREAS GEOLOCALIZADAS EN VIVO</text>
      </svg>
      <div className="maplegend">
        <span className="it"><span className="led" style={{ background: '#ff3b5c' }} />Zona con prioridad alta</span>
        <span className="it"><span className="led" style={{ background: '#28d3a7' }} />Tareas abiertas</span>
        <span className="it"><span className="led" style={{ background: '#ffb01f' }} />Todo en curso</span>
      </div>
    </div>
  );
}
