'use client';
/* Tarjeta de tarea (lista) — limpia, sin emojis, ordenada. Es un preview:
   al tocarla se abre el detalle (con mapa). Mantiene la acción de tomar. */
import { PRIOS, SKILLS, ago, taskState, takenCount } from '@/lib/model';

const STATE_BADGE = {
  abierta: ['state-abierta', 'Abierta'],
  tomada: ['state-tomada', 'Tomada'],
  curso: ['state-curso', 'En curso'],
  completada: ['state-completada', 'Completada'],
};

export default function TaskCard({ t, mode, i = 0, h, distanceLabel, onOpen }) {
  const st = taskState(t);
  const taken = takenCount(t);
  const pct = Math.min(100, Math.round((taken / t.need) * 100));
  const sk = SKILLS[t.skill];
  const [cls, label] = STATE_BADGE[st] || STATE_BADGE.abierta;

  const stop = (e) => e.stopPropagation();
  let action = null;
  if (mode === 'vol') {
    action = taken < t.need
      ? <button className="btn btn-take btn-block" onClick={() => h.take(t.id)}>Tomar esta tarea</button>
      : <button className="btn btn-ghost btn-block btn-sm" disabled>Cupos completos</button>;
  } else {
    action = (
      <div className="g2" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => h.cyclePrio(t.id, t.prio)}>Prioridad</button>
        <button className="btn btn-danger btn-sm" onClick={() => h.cancel(t.id)}>Cerrar</button>
      </div>
    );
  }

  const who = mode === 'coord' && (t.takenBy || []).length
    ? (t.takenBy || []).filter((x) => x.state !== 'soltada').map((x) => x.name).join(', ')
    : null;

  return (
    <article className="task tidy" data-prio={t.prio} style={{ animationDelay: `${i * 50}ms`, cursor: onOpen ? 'pointer' : 'default' }}
      onClick={onOpen} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(e) => { if (onOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); } }}>
      <span className="spine" />
      <div className="body">
        <div className="top">
          <div className="title">{t.title}</div>
          <span className="prio-tag">{PRIOS[t.prio].label}</span>
        </div>

        <div className="loc">{t.loc}</div>

        <div className="facts">
          <span>Faltan <b>{t.need}</b> {t.need === 1 ? 'persona' : 'personas'}</span>
          {sk && <span className="skill">{sk.label}</span>}
        </div>

        {t.reporterName && <div className="reporter">📣 Reportada por <b>{t.reporterName}</b></div>}
        {distanceLabel && <div className="dist">A <b>{distanceLabel}</b> de ti</div>}
        {who && <div className="dist">Asignada a <b>{who}</b></div>}

        <div className="cupos">
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="lab"><span>{taken} de {t.need} {taken === 1 ? 'cupo' : 'cupos'}</span><span>{ago(t.created)}</span></div>
        </div>

        <div className="foot">
          <span className={`state-badge ${cls}`}><span className="led" />{label}</span>
          {onOpen && <span className="open-hint">Ver detalle ›</span>}
        </div>
        <div style={{ marginTop: 13 }} onClick={stop}>{action}</div>
      </div>
    </article>
  );
}
