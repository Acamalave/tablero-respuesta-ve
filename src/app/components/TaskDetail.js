'use client';
/* Detalle de una tarea (modal) — aquí SÍ se muestra el mapa, además de
   la distancia a la persona y las acciones. La lista queda liviana. */
import { PRIOS, SKILLS, ZONES, ago, taskState, takenCount } from '@/lib/model';
import TaskMiniMap from './TaskMiniMap';

const STATE_BADGE = {
  abierta: ['state-abierta', 'Abierta'],
  tomada: ['state-tomada', 'Tomada'],
  curso: ['state-curso', 'En curso'],
  completada: ['state-completada', 'Completada'],
};
const PRIO_HEX = { alta: '#e11d48', media: '#d97706', baja: '#0d9a6c' };

export default function TaskDetail({ t, mode, distanceLabel, h, onClose }) {
  const st = taskState(t);
  const taken = takenCount(t);
  const pct = Math.min(100, Math.round((taken / t.need) * 100));
  const sk = SKILLS[t.skill];
  const [cls, label] = STATE_BADGE[st] || STATE_BADGE.abierta;
  const Z = ZONES[t.zone];

  const close = (e) => { if (e.target.classList.contains('modal-bg')) onClose(); };
  const take = () => { h.take(t.id); onClose(); };

  return (
    <div className="modal-bg show" onClick={close}>
      <div className="modal" data-prio={t.prio}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <h3 style={{ lineHeight: 1.2 }}>{t.title}</h3>
          <span className={`prio-tag prio-${t.prio}`} style={{ color: PRIO_HEX[t.prio], background: PRIOS[t.prio].bg }}>{PRIOS[t.prio].label}</span>
        </div>
        <div className="sub">{Z?.name} · {Z?.sector}</div>

        <div className="meta" style={{ marginBottom: 14 }}>
          <div className="row"><span className="mi">📍</span><span>{t.loc}</span></div>
          <div className="row"><span className="mi">👥</span>Hacen falta <b>&nbsp;{t.need}&nbsp;</b> {t.need === 1 ? 'persona' : 'personas'}</div>
          {sk && <div className="row"><span className="mi">🛠️</span><span className="skill">{sk.icon} {sk.label}</span></div>}
          {distanceLabel && <div className="row"><span className="mi">🧭</span>A <b>&nbsp;{distanceLabel}&nbsp;</b> de tu ubicación</div>}
        </div>

        <TaskMiniMap zone={t.zone} color={PRIO_HEX[t.prio]} />

        <div className="cupos">
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="lab"><span>{taken} de {t.need} {taken === 1 ? 'cupo' : 'cupos'}</span><span>🕐 {ago(t.created)}</span></div>
        </div>
        <div className="foot" style={{ marginTop: 12 }}>
          <span className={`state-badge ${cls}`}><span className="led" />{label}</span>
        </div>

        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          {mode === 'vol'
            ? (taken < t.need
                ? <button className="btn btn-take" onClick={take}>✋ Tomar esta tarea</button>
                : <button className="btn btn-ghost" disabled>Cupos completos</button>)
            : <button className="btn btn-danger" onClick={() => { h.cancel(t.id); onClose(); }}>Cerrar tarea</button>}
        </div>
      </div>
    </div>
  );
}
