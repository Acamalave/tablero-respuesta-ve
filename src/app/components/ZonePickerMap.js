'use client';
/* Selector de ubicación en el mapa — el usuario toca una zona para fijar el
   pin del reporte. Mapa estilizado (sin dependencias), coherente con el resto. */
import { ZONES, ZONE_KEYS } from '@/lib/model';

const cy = (z) => 12 + ((ZONES[z].y - 22) / (60 - 22)) * 26; // banda segura

export default function ZonePickerMap({ value, onPick }) {
  return (
    <div className="task-map" style={{ marginTop: 0 }}>
      <svg viewBox="0 0 100 50" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Elegir ubicación en el mapa">
        <defs>
          <pattern id="zpgrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="#e6ecf5" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100" height="50" fill="url(#zpgrid)" />
        {ZONE_KEYS.map((z) => {
          const Z = ZONES[z];
          const sel = value === z;
          const col = '#e4002b';
          return (
            <g key={z} style={{ cursor: 'pointer' }} onClick={() => onPick(z)}>
              {/* zona de toque amplia */}
              <circle cx={Z.x} cy={cy(z)} r="9" fill="transparent" />
              {sel ? (
                <>
                  <circle cx={Z.x} cy={cy(z)} r="8" fill={col} opacity="0.12" />
                  <g transform={`translate(${Z.x}, ${cy(z)})`}>
                    <path d="M0,-7 C3.5,-7 5,-4.2 5,-1.8 C5,1.2 0,5.5 0,5.5 C0,5.5 -5,1.2 -5,-1.8 C-5,-4.2 -3.5,-7 0,-7 Z" fill={col} />
                    <circle cx="0" cy="-2" r="1.8" fill="#fff" />
                  </g>
                  <text x={Z.x} y={cy(z) + 11} fill="#182030" fontSize="3.2" fontWeight="700" fontFamily="Chivo, sans-serif" textAnchor="middle">{Z.name}</text>
                </>
              ) : (
                <>
                  <circle cx={Z.x} cy={cy(z)} r="2" fill="#9aa6ba" />
                  <text x={Z.x} y={cy(z) - 3} fill="#6b7689" fontSize="3" fontFamily="IBM Plex Sans, sans-serif" textAnchor="middle">{Z.name}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
