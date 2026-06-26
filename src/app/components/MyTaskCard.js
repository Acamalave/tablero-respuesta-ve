'use client';
/* "Mis tareas" — tarea ya tomada por el voluntario, con sus FASES
   (Tomada → En curso → Completada) y acciones, incluida "No pude terminarla". */
import { PRIOS, SKILLS, ago, COORD_NAME, COORD_PHONE } from '@/lib/model';
import TaskMiniMap from './TaskMiniMap';

// Normaliza un teléfono venezolano a formato internacional para tel:/WhatsApp.
function intlNumber(phone) {
  let d = (phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('58')) return d;
  if (d.startsWith('0')) return '58' + d.slice(1);
  if (d.length === 10) return '58' + d;
  return d;
}

// Mensaje predeterminado de WhatsApp: el voluntario se anuncia con su nombre
// y lo que va a hacer (la tarea), poniéndose en contacto.
function waText(t, mine, isReporter) {
  const yo = (mine && mine.name) || 'un voluntario';
  const lugar = t.loc ? ` (${t.loc})` : '';
  if (isReporter) {
    const a = t.reporterName ? `Hola ${t.reporterName}, ` : 'Hola, ';
    return encodeURIComponent(`${a}soy ${yo}, voluntario de Tarea: Venezuela. ` +
      `Tomé tu reporte y voy a ayudar con: "${t.title}"${lugar}. Me pongo en contacto contigo para coordinar.`);
  }
  return encodeURIComponent(`Hola, soy ${yo}, voluntario de Tarea: Venezuela. ` +
    `Tomé la tarea "${t.title}"${lugar} y me pongo en contacto para coordinar.`);
}

const PRIO_HEX = { alta: '#e11d48', media: '#d97706', baja: '#0d9a6c' };
const PHASES = [
  { key: 'tomada', lab: 'Tomada' },
  { key: 'curso', lab: 'En curso' },
  { key: 'completada', lab: 'Completada' },
];
const IDX = { tomada: 0, curso: 1, completada: 2 };

export default function MyTaskCard({ t, mine, online, contact, h, i = 0 }) {
  const cur = IDX[mine.state] ?? 0;
  const sk = SKILLS[t.skill];

  return (
    <article className="task mytask" data-prio={t.prio} style={{ animationDelay: `${i * 50}ms` }}>
      <span className="spine" />
      <div className="head">
        <div>
          <div className="title">{t.title}</div>
          <div className="loc"><span>📍</span>{t.loc}</div>
        </div>
        <span className="prio-tag">{PRIOS[t.prio].label}</span>
      </div>
      <div className="body">
        <TaskMiniMap zone={t.zone} color={PRIO_HEX[t.prio]} height={104} />

        {/* Stepper de fases */}
        <div className="stepper" style={{ marginTop: 14 }}>
          {PHASES.map((p, idx) => {
            const done = idx < cur;
            const current = idx === cur;
            const completed = current && mine.state === 'completada';
            const stpCls = completed ? 'completed' : done ? 'done' : current ? 'current' : 'todo';
            return (
              <div key={p.key} style={{ display: 'contents' }}>
                <div className={`stp ${stpCls}`}>
                  <div className="dot">{done || completed ? '✓' : idx + 1}</div>
                  <div className="lab">{p.lab}</div>
                </div>
                {idx < PHASES.length - 1 && <div className={`link ${idx < cur ? 'on' : ''}`} />}
              </div>
            );
          })}
        </div>

        {sk && <div className="meta" style={{ marginTop: 6 }}><div className="row"><span className="mi">🛠️</span><span className="skill">{sk.icon} {sk.label}</span></div></div>}

        {(() => {
          const isReporter = !!t.reporterPhone;
          const num = intlNumber(isReporter ? t.reporterPhone : COORD_PHONE);
          return (
            <div className="contact-box">
              <div className="contact-who">
                {isReporter
                  ? <>📣 Reportado por <b>{t.reporterName || 'un ciudadano'}</b> · ponte en contacto:</>
                  : <>📞 Contacto del <b>{COORD_NAME}</b> · coordina la tarea:</>}
              </div>
              <div className="contact-actions">
                <a className="btn btn-primary btn-sm" href={`tel:+${num}`}>📞 Llamar</a>
                <a className="btn btn-wa btn-sm" href={`https://wa.me/${num}?text=${waText(t, mine, isReporter)}`} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
              </div>
            </div>
          );
        })()}

        {!online && <div className="pend"><span className="state-badge state-pendiente"><span className="led" />Pendiente de sincronizar</span></div>}

        {/* Acciones según la fase */}
        {mine.state === 'tomada' && (
          <div className="acts">
            <button className="btn btn-go" onClick={() => h.start(t.id)}>▶️ Empecé</button>
            <button className="btn btn-danger" onClick={() => h.release(t.id)}>✖️ No puedo</button>
          </div>
        )}
        {mine.state === 'curso' && (
          <div className="acts">
            <button className="btn btn-done" onClick={() => h.complete(t.id)}>✔️ Completada</button>
            <button className="btn btn-danger" onClick={() => h.release(t.id)}>No pude terminarla</button>
          </div>
        )}
        {mine.state === 'completada' && (
          <div className="done-msg">🎉 ¡Completada! Gracias por responder.</div>
        )}

        <div className="foot" style={{ marginTop: 12 }}>
          <span className="stamp">🕐 Publicada {ago(t.created)}</span>
        </div>
      </div>
    </article>
  );
}
