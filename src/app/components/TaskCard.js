'use client';
/* Tarjeta de tarea — compartida por coordinador y voluntario */
import { PRIOS, SKILLS, ZONES, ago, taskState, takenCount } from '@/lib/model';

const STATE_BADGE = {
  abierta: ['state-abierta', 'Abierta'],
  tomada: ['state-tomada', 'Tomada'],
  curso: ['state-curso', 'En curso'],
  completada: ['state-completada', 'Completada'],
  cancelada: ['state-completada', 'Cancelada'],
};

export default function TaskCard({ t, mode, vo, online, i = 0, h }) {
  const st = taskState(t);
  const taken = takenCount(t);
  const pct = Math.min(100, Math.round((taken / t.need) * 100));
  const sk = SKILLS[t.skill];
  const mine = vo?.mine;
  const [cls, label] = STATE_BADGE[st] || STATE_BADGE.abierta;

  let actions = null;
  if (mode === 'vol') {
    if (mine) {
      const pend = !online ? (
        <span className="state-badge state-pendiente" style={{ marginBottom: 8 }}><span className="led" />Pendiente de sincronizar</span>
      ) : null;
      if (mine.state === 'tomada') {
        actions = (
          <>{pend}<div className="g2" style={{ gap: 8 }}>
            <button className="btn btn-go btn-sm" onClick={() => h.start(t.id)}>▶️ Empecé</button>
            <button className="btn btn-danger btn-sm" onClick={() => h.release(t.id)}>✖️ No puedo</button>
          </div></>
        );
      } else if (mine.state === 'curso') {
        actions = <>{pend}<button className="btn btn-done btn-block btn-sm" onClick={() => h.complete(t.id)}>✔️ Completada</button></>;
      }
    } else if (st === 'abierta' || taken < t.need) {
      actions = <button className="btn btn-take btn-block" onClick={() => h.take(t.id)}>✋ Tomar esta tarea</button>;
    } else {
      actions = <button className="btn btn-ghost btn-block btn-sm" disabled>Cupos completos</button>;
    }
  } else {
    actions = (
      <div className="g2" style={{ gap: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => h.cyclePrio(t.id, t.prio)}>⇅ Prioridad</button>
        <button className="btn btn-danger btn-sm" onClick={() => h.cancel(t.id)}>Cerrar</button>
      </div>
    );
  }

  const who = mode === 'coord' && (t.takenBy || []).length ? (
    <div className="meta"><div className="row"><span className="mi">👤</span>
      {(t.takenBy || []).filter((x) => x.state !== 'soltada').map((x) => x.name).join(', ') || '—'}
    </div></div>
  ) : null;

  const near = vo && vo.zone ? (
    <div className="row"><span className="mi">🧭</span>
      {vo.proximity < 12 ? <b style={{ color: 'var(--p-baja)' }}>Muy cerca de ti</b>
        : vo.proximity < 28 ? 'Cerca de ti' : 'Más lejos'}
    </div>
  ) : null;

  return (
    <article className="task" data-prio={t.prio} style={{ animationDelay: `${i * 55}ms` }}>
      <span className="spine" />
      <div className="body">
        <div className="top">
          <div className="title">{t.title}</div>
          <div style={{ display: 'flex', gap: 6, flexDirection: 'column', alignItems: 'flex-end' }}>
            <span className="prio-tag">{PRIOS[t.prio].label}</span>
            {mine && <span className="prio-tag" style={{ color: 'var(--ve-yellow)', background: 'rgba(255,209,0,.12)' }}>TUYA</span>}
          </div>
        </div>
        <div className="meta">
          <div className="row"><span className="mi">📍</span>{t.loc}</div>
          <div className="row"><span className="mi">👥</span>Se necesitan: <b>{t.need}</b> {t.need === 1 ? 'persona' : 'personas'}</div>
          {sk && <div className="row"><span className="mi">🛠️</span><span className="skill">{sk.icon} {sk.label}</span></div>}
          {near}
        </div>
        {who}
        <div className="cupos">
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <div className="lab"><span>{taken} de {t.need} {taken === 1 ? 'cupo tomado' : 'cupos tomados'}</span><span>{pct}%</span></div>
        </div>
        <div className="foot">
          <span className="stamp">🕐 {ago(t.created)}</span>
          <span className={`state-badge ${cls}`}><span className="led" />{label}</span>
        </div>
        <div style={{ marginTop: 13 }}>{actions}</div>
      </div>
    </article>
  );
}
