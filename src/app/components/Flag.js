'use client';
/* Emblema de la bandera de Venezuela — 3 bandas + arco de 8 estrellas */

function starPoints(cx, cy, R) {
  let pts = '';
  for (let i = 0; i < 5; i++) {
    const ao = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const ai = ao + Math.PI / 5;
    pts += `${cx + R * Math.cos(ao)},${cy + R * Math.sin(ao)} ${cx + R * 0.4 * Math.cos(ai)},${cy + R * 0.4 * Math.sin(ai)} `;
  }
  return pts.trim();
}

export default function Flag({ size = 42 }) {
  const cx = 30, cy = 33, r = 13, n = 8;
  const a0 = Math.PI * 1.18, a1 = Math.PI * 1.82;
  const stars = Array.from({ length: n }, (_, i) => {
    const a = a0 + (a1 - a0) * (i / (n - 1));
    return starPoints(cx + r * Math.cos(a), cy + r * Math.sin(a), 1.5);
  });
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Bandera de Venezuela">
      <rect width="60" height="20" y="0" fill="#FFD100" />
      <rect width="60" height="20" y="20" fill="#0A47A6" />
      <rect width="60" height="20" y="40" fill="#E4002B" />
      <g fill="#ffffff">
        {stars.map((p, i) => (
          <polygon key={i} points={p} />
        ))}
      </g>
    </svg>
  );
}
