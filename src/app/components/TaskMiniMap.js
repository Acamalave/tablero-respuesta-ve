'use client';
/* Mini-mapa de ubicación de una tarea (SVG, tono claro, sin dependencias).
   Muestra la región norte-central con la zona de la tarea resaltada.
   Banda vertical [12..32] + preserveAspectRatio "meet" → nunca se recorta. */
import { ZONES, ZONE_KEYS } from '@/lib/model';

// mapea la latitud cruda (y 22..60) a una banda segura del lienzo (12..32)
const cy = (z) => 12 + ((ZONES[z].y - 22) / (60 - 22)) * 20;

export default function TaskMiniMap({ zone, color = '#1E6BE6' }) {
  const Z = ZONES[zone];
  if (!Z) return null;

  return (
    <div className="task-map">
      <svg viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`Ubicación: ${Z.name}`}>
        <defs>
          <pattern id={`grid-${zone}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="#e6ecf5" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100" height="50" fill={`url(#grid-${zone})`} />

        {/* otras zonas (referencia, tenues) */}
        {ZONE_KEYS.filter((z) => z !== zone).map((z) => (
          <g key={z}>
            <circle cx={ZONES[z].x} cy={cy(z)} r="1.3" fill="#c3ccdb" />
            <text x={ZONES[z].x} y={cy(z) - 2.6} fill="#aab4c4" fontSize="2.5" fontFamily="IBM Plex Sans, sans-serif" textAnchor="middle">{ZONES[z].name}</text>
          </g>
        ))}

        {/* zona de la tarea: halo + pin */}
        <circle cx={Z.x} cy={cy(zone)} r="8" fill={color} opacity="0.12" />
        <circle cx={Z.x} cy={cy(zone)} r="8" fill="none" stroke={color} opacity="0.4">
          <animate attributeName="r" values="5;10;5" dur="2.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2.8s" repeatCount="indefinite" />
        </circle>
        <g transform={`translate(${Z.x}, ${cy(zone)})`}>
          <path d="M0,-7 C3.5,-7 5,-4.2 5,-1.8 C5,1.2 0,5.5 0,5.5 C0,5.5 -5,1.2 -5,-1.8 C-5,-4.2 -3.5,-7 0,-7 Z" fill={color} />
          <circle cx="0" cy="-2" r="1.8" fill="#fff" />
        </g>
        <text x={Z.x} y={cy(zone) + 11} fill="#182030" fontSize="3.4" fontWeight="700" fontFamily="Chivo, sans-serif" textAnchor="middle">{Z.name}</text>
        <text x={Z.x} y={cy(zone) + 15.2} fill="#8b95a6" fontSize="2.6" fontFamily="IBM Plex Sans, sans-serif" textAnchor="middle">{Z.sector}</text>
      </svg>
    </div>
  );
}
