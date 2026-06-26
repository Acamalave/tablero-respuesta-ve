'use client';
/* Logo — guacamaya geométrica (perfil), con la cresta en tricolor venezolano. */
export default function Logo({ size = 42 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} xmlns="http://www.w3.org/2000/svg" aria-label="Tarea: Venezuela">
      <g transform="translate(1,6)">
        {/* cresta de plumas tricolor */}
        <polygon points="30,18 34,2 41,17" fill="#FCD116" />
        <polygon points="38,16 48,3 50,19" fill="#E4002B" />
        <polygon points="46,19 58,12 53,28" fill="#1E6BE6" />
        {/* cabeza */}
        <path d="M31,15 Q47,15 48,32 Q48,49 30,49 Q20,45 20,33 Q20,20 31,15 Z" fill="#0A47A6" />
        {/* parche facial claro */}
        <path d="M30,19 Q18,20 17,30 Q18,40 30,40 Q35,34 35,29 Q35,23 30,19 Z" fill="#EEF3FB" />
        {/* pico superior (curvo, en gancho) */}
        <path d="M30,21 Q11,19 4,30 Q12,33 19,31 Q25,30 30,27 Z" fill="#171D2B" />
        {/* pico inferior */}
        <path d="M19,32 Q10,35 17,39 Q25,39 27,34 Z" fill="#2A3346" />
        {/* ojo */}
        <circle cx="29" cy="27" r="3.2" fill="#0C1322" />
        <circle cx="30.2" cy="25.8" r="1" fill="#fff" />
      </g>
    </svg>
  );
}
