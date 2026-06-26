'use client';
/* =====================================================================
   TABLERO DE RESPUESTA · VE — App principal (Next.js + Firebase)
   Tiempo real con Firestore. La organización coordina; la gente toma.
   ===================================================================== */
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Flag from './components/Flag';
import TaskCard from './components/TaskCard';
import TacticalMap from './components/TacticalMap';
import {
  ZONES, ZONE_KEYS, SKILLS, PRIOS, PRIO_ORDER,
  dist, taskState, takenCount, avatarFor, prioBg, ago, COORD_CONTACT,
} from '@/lib/model';
import * as store from '@/lib/store';

const VOL_KEY = 'tablero_vol_v1';

export default function Page() {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState(null);
  const [role, setRole] = useState('voluntario');
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [online, setOnline] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [coordTab, setCoordTab] = useState('tablero');
  const [vol, setVol] = useState(null);            // perfil del voluntario actual
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);        // { prefill } | null
  const [, forceTick] = useState(0);

  /* ---- Toasts ---- */
  const pushToast = useCallback((title, body, icon = '🔔', tag = 'Notificación') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, title, body, icon, tag }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  /* ---- Arranque: auth + semilla + suscripciones ---- */
  useEffect(() => {
    let unsubs = [];
    (async () => {
      store.tryAnonAuth();                 // oportunista; no bloquea
      const myUid = store.clientUid();     // identidad persistente (localStorage)
      setUid(myUid);
      try { await store.seedIfEmpty(); } catch {}
      unsubs.push(store.subTasks((rows, meta) => { setTasks(rows); setFromCache(meta.fromCache); }));
      unsubs.push(store.subReports((rows) => setReports(rows)));
      unsubs.push(store.subVolunteers((rows) => setVolunteers(rows)));
      try {
        const saved = JSON.parse(localStorage.getItem(VOL_KEY) || 'null');
        if (saved) setVol({ ...saved, uid: myUid });
      } catch {}
      setReady(true);
    })();
    const tick = setInterval(() => forceTick((n) => n + 1), 60000); // refresca "hace X min"
    return () => { unsubs.forEach((f) => f && f()); clearInterval(tick); };
  }, []);

  /* ---- done del voluntario desde la colección ---- */
  const myDone = useMemo(() => volunteers.find((v) => v.id === uid)?.done ?? vol?.done ?? 0, [volunteers, uid, vol]);

  /* ---- Toggle de conexión (offline-first real de Firestore) ---- */
  async function toggleNet() {
    const next = !online;
    setOnline(next);
    if (next) { await store.goOnline(); pushToast('Conexión restablecida', 'Sincronizando cambios pendientes con el servidor…', '📶', 'Red'); }
    else { await store.goOffline(); pushToast('Sin red', 'Tus acciones se guardan local (IndexedDB) y se sincronizan al reconectar.', '📴', 'Offline-first'); }
  }

  /* ---- Handlers de tareas ---- */
  const h = {
    take: async (id) => {
      try {
        const r = await store.takeTask(id, { name: vol.name, uid });
        if (r === 'ok') pushToast('Tomaste esta tarea', `Contacto: ${COORD_CONTACT}`, '✅', online ? 'Confirmado' : 'Pendiente · offline');
        else if (r === 'ya-tomada') pushToast('Ya la tenías', 'Esta tarea ya estaba en tu lista.', 'ℹ️', 'Aviso');
      } catch (e) {
        if (String(e.message).includes('cupo')) pushToast('Cupo lleno', 'Otra persona tomó el último cupo.', '⚠️', 'Aviso');
      }
    },
    start: (id) => store.startTask(id, uid),
    complete: async (id) => { await store.completeTask(id, uid); store.bumpVolunteerDone(uid); pushToast('¡Tarea completada!', 'Suma a tu aporte. Gracias por responder.', '🎉', 'Logrado'); },
    release: async (id) => { await store.releaseTask(id, uid); pushToast('Tarea liberada', 'Vuelve a estar disponible para otro voluntario.', '↩️', 'Aviso'); },
    cyclePrio: (id, cur) => store.cyclePrio(id, cur),
    cancel: async (id) => { await store.cancelTask(id); pushToast('Tarea cerrada', 'Salió del tablero activo.', '🗑️', 'Coordinador'); },
  };

  /* ---- Topbar ---- */
  const pending = !online; // en offline, todo lo escrito queda pendiente de sync
  const topbar = (
    <header className="topbar">
      <div className="brand">
        <span className="flag"><Flag size={42} /></span>
        <div className="brand-txt">
          <h1>TABLERO DE <b>RESPUESTA</b></h1>
          <span>Coordinación · Venezuela</span>
        </div>
      </div>
      <div className="topbar-spacer" />
      <button className={`netchip ${!online ? 'off' : fromCache ? 'syncing' : ''}`} onClick={toggleNet} title="Alternar conexión (offline-first real con Firestore)">
        <span className="dot" />
        <span>{online ? (fromCache ? 'CONECTANDO' : 'EN LÍNEA') : 'SIN RED'}</span>
      </button>
      <nav className="roleswitch" aria-label="Cambiar actor">
        {[['coordinador', '🧭', 'Coordinador'], ['voluntario', '🙋', 'Voluntario'], ['reportante', '📢', 'Reportar']].map(([r, ic, lbl]) => (
          <button key={r} className={role === r ? 'active' : ''} onClick={() => { setRole(r); setCoordTab('tablero'); }}>
            <span className="ic">{ic}</span><span className="lbl-txt">{lbl}</span>
          </button>
        ))}
      </nav>
    </header>
  );

  /* ---- Render principal ---- */
  return (
    <div className="app">
      {topbar}
      <main>
        {!ready ? (
          <div className="boot"><div><div className="ring" style={{ margin: '0 auto' }} /><div className="txt">Conectando con el centro de mando…</div></div></div>
        ) : role === 'coordinador' ? (
          <Coordinador {...{ tasks, reports, volunteers, coordTab, setCoordTab, h, openCreate: (p) => setModal({ prefill: p || null }), onConvert: (r) => setModal({ prefill: r }), onDiscard: (id) => store.setReportStatus(id, 'descartado') }} />
        ) : role === 'voluntario' ? (
          vol ? <Voluntario {...{ tasks, vol: { ...vol, uid, done: myDone }, online, h }} />
              : <Onboarding onDone={(v) => { localStorage.setItem(VOL_KEY, JSON.stringify(v)); const full = { ...v, uid }; setVol(full); store.upsertVolunteer({ ...full, done: 0 }); pushToast('¡Bienvenido!', 'Aquí están las tareas abiertas, ordenadas para ti.', '🙋', 'Voluntario'); }} />
        ) : (
          <Reportante reports={reports} onSend={async (data) => { await store.createReport(data); pushToast('Reporte enviado', 'Un coordinador lo revisará pronto. Gracias por avisar.', '📨', 'Reportante'); }} />
        )}
      </main>

      <p className="demo-note">
        Tiempo real con <b>Firebase Firestore</b> · <b>Accios Core</b> — abre esta URL en dos ventanas y verás el tablero
        actualizarse en vivo · alterna <b>EN LÍNEA / SIN RED</b> para probar offline-first
      </p>

      {modal && <CreateModal prefill={modal.prefill} onClose={() => setModal(null)} onSave={async (data, prefill) => {
        await store.createTask(data);
        if (prefill?.id) store.setReportStatus(prefill.id, 'convertido');
        setModal(null);
        pushToast('Tarea publicada', `“${data.title}” ya está en el tablero. Avisando a voluntarios cercanos.`, '📡', 'Coordinador');
      }} />}

      <div className="toasts">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            <div className="ti">{t.icon}</div>
            <div className="tt"><span className="tag">{t.tag}</span><b>{t.title}</b><span>{t.body}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ====================================================================
   COORDINADOR
   ==================================================================== */
function Coordinador({ tasks, reports, volunteers, coordTab, setCoordTab, h, openCreate, onConvert, onDiscard }) {
  const open = tasks.filter((t) => taskState(t) === 'abierta').length;
  const curso = tasks.filter((t) => ['tomada', 'curso'].includes(taskState(t))).length;
  const done = tasks.filter((t) => taskState(t) === 'completada').length;
  const pend = reports.filter((r) => r.status === 'pendiente').length;

  return (
    <section className="view">
      <div className="section-head">
        <span className="kicker">Panel del coordinador</span><h2>Operación en vivo</h2><div className="rule" />
        <button className="btn btn-primary btn-sm" onClick={() => openCreate()}>➕ Crear tarea</button>
      </div>
      <div className="stats">
        <Stat n={open} l="Abiertas" a="var(--p-baja)" />
        <Stat n={curso} l="En curso" a="var(--p-media)" />
        <Stat n={done} l="Completadas" a="var(--ink-dim)" />
        <Stat n={pend} l="Por revisar" a="var(--ve-red)" />
      </div>
      <div className="subtabs">
        {[['tablero', '🗂️ Tablero'], ['voluntarios', `👥 Voluntarios`], ['mapa', '🛰️ Mapa'], ['reportes', `📥 Reportes`]].map(([k, lbl]) => (
          <button key={k} className={coordTab === k ? 'active' : ''} onClick={() => setCoordTab(k)}>
            {lbl}{k === 'voluntarios' && <span className="count">{volunteers.length}</span>}{k === 'reportes' && <span className="count">{pend}</span>}
          </button>
        ))}
      </div>

      {coordTab === 'tablero' && <CoordBoard tasks={tasks} h={h} />}
      {coordTab === 'voluntarios' && <Roster volunteers={volunteers} />}
      {coordTab === 'mapa' && <TacticalMap tasks={tasks} />}
      {coordTab === 'reportes' && <Inbox reports={reports} onConvert={onConvert} onDiscard={onDiscard} />}
    </section>
  );
}

function Stat({ n, l, a }) {
  return <div className="stat" style={{ '--accent': a }}><div className="num">{n}</div><div className="lbl">{l}</div></div>;
}

function CoordBoard({ tasks, h }) {
  const groups = ['alta', 'media', 'baja'].map((prio) => {
    const list = tasks.filter((t) => t.prio === prio && !['completada', 'cancelada'].includes(taskState(t))).sort((a, b) => b.created - a.created);
    if (!list.length) return null;
    return (
      <div className="prio-group" key={prio}>
        <div className="ph">
          <span className="pill" style={{ color: PRIOS[prio].color, background: prioBg(prio) }}>
            <span className="led" style={{ background: PRIOS[prio].led, boxShadow: `0 0 8px ${PRIOS[prio].led}` }} />
            {PRIOS[prio].label.toUpperCase()} · {list.length}
          </span>
        </div>
        <div className="task-grid">{list.map((t, i) => <TaskCard key={t.id} t={t} mode="coord" i={i} h={h} online />)}</div>
      </div>
    );
  });
  const any = groups.some(Boolean);
  return any ? <>{groups}</> : <Empty title="Sin tareas activas" sub="Crea la primera tarea para empezar a coordinar." />;
}

function Roster({ volunteers }) {
  if (!volunteers.length) return <Empty title="Sin voluntarios aún" sub="Los voluntarios aparecerán al registrarse." />;
  return (
    <div className="roster">
      {volunteers.map((v) => (
        <div className="panel vcard" key={v.id}>
          <div className="av">{avatarFor(v.name)}</div>
          <div>
            <div className="vn">{v.name}</div>
            <div className="vt">📍 {ZONES[v.zone]?.name || '—'}</div>
            <div className="vsk">{(v.skills || []).map((s) => <i key={s} title={SKILLS[s]?.label}>{SKILLS[s]?.icon}</i>)}</div>
          </div>
          <div className="vct"><b>{v.done ?? 0}</b><span>aportes</span></div>
        </div>
      ))}
    </div>
  );
}

function Inbox({ reports, onConvert, onDiscard }) {
  const list = reports.filter((r) => r.status === 'pendiente').sort((a, b) => b.created - a.created);
  if (!list.length) return <Empty title="Bandeja limpia" sub="No hay reportes ciudadanos por revisar." />;
  return (
    <div>
      {list.map((r) => (
        <div className="panel report-item" key={r.id}>
          <div className="ri">📢</div>
          <div className="rc">
            <b>{r.need}</b>
            <div className="rl">📍 {r.loc}</div>
            {r.note && <div className="rn">“{r.note}”</div>}
            <div className="rs">Reportado {ago(r.created)} · zona: {ZONES[r.zone]?.name || 'sin definir'}</div>
          </div>
          <div className="ra">
            <button className="btn btn-take btn-sm" onClick={() => onConvert(r)}>✓ Convertir en tarea</button>
            <button className="btn btn-ghost btn-sm" onClick={() => onDiscard(r.id)}>Descartar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ====================================================================
   VOLUNTARIO
   ==================================================================== */
function Voluntario({ tasks, vol, online, h }) {
  const visible = useMemo(() => {
    const ref = vol.zone;
    return tasks
      .filter((t) => ['abierta', 'tomada', 'curso'].includes(taskState(t)))
      .map((t) => ({
        t,
        mine: (t.takenBy || []).find((x) => x.uid === vol.uid && x.state !== 'soltada' && x.state !== 'completada'),
        proximity: ref ? dist(ref, t.zone) : 50,
        skillMatch: (vol.skills || []).includes(t.skill) ? 0 : 1,
      }))
      .sort((a, b) =>
        PRIO_ORDER[a.t.prio] - PRIO_ORDER[b.t.prio] || a.proximity - b.proximity || a.skillMatch - b.skillMatch || b.t.created - a.t.created
      );
  }, [tasks, vol]);

  return (
    <section className="view">
      <div className="panel vol-head">
        <div className="ava">{avatarFor(vol.name)}</div>
        <div className="who"><b>{vol.name}</b><span>📍 {ZONES[vol.zone]?.name || 'Sin zona'} · {(vol.skills || []).length ? vol.skills.map((s) => SKILLS[s].icon).join(' ') : 'sin habilidades marcadas'}</span></div>
        <div className="aporte"><b>{vol.done ?? 0}</b><span>mi aporte</span></div>
      </div>
      <div className="section-head"><span className="kicker">Tablero de tareas</span><h2>Tareas abiertas</h2><div className="rule" /></div>
      <div className="subtabs">
        <button className="active" style={{ cursor: 'default' }}>↑ Ordenado por prioridad · cercanía a {ZONES[vol.zone]?.name || 'tu zona'} · tu habilidad</button>
      </div>
      {visible.length ? (
        <div className="task-grid">{visible.map((o, i) => <TaskCard key={o.t.id} t={o.t} mode="vol" vo={o} online={online} i={i} h={h} />)}</div>
      ) : (
        <Empty title="Todo cubierto" sub="No hay tareas abiertas ahora mismo. Te avisaremos cuando surja una cerca de ti." />
      )}
    </section>
  );
}

function Onboarding({ onDone }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState([]);
  const [zone, setZone] = useState('');
  const toggle = (k) => setSkills((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  return (
    <section className="view onboard">
      <div className="panel hero">
        <h2>Quiero <span>ayudar</span></h2>
        <p>En menos de un minuto verás las tareas abiertas cerca de ti y podrás tomar la que puedas hacer. La organización coordina; tú decides y actúas.</p>
      </div>
      <div className="panel" style={{ padding: 22, marginTop: 16 }}>
        <div className="field"><label>Tu nombre o alias</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Carlos R." /></div>
        <div className="field"><label>Teléfono (verificación SMS — simulada)</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 4xx-xxxxxxx" inputMode="tel" /></div>
        <div className="field"><label>¿Qué sabes / puedes hacer? (opcional)</label>
          <div className="chips">{Object.entries(SKILLS).map(([k, s]) => (
            <div key={k} className={`chip ${skills.includes(k) ? 'on' : ''}`} onClick={() => toggle(k)}><span>{s.icon}</span>{s.label}</div>
          ))}</div>
        </div>
        <div className="field"><label>Tu zona (si niegas el GPS, la eliges aquí)</label>
          <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">📍 Detectar / elegir zona…</option>
            {ZONE_KEYS.map((z) => <option key={z} value={z}>{ZONES[z].name} · {ZONES[z].sector}</option>)}
          </select>
        </div>
        <button className="btn btn-take btn-block" style={{ marginTop: 8 }} onClick={() => onDone({ name: name.trim() || 'Voluntario', phone: phone.trim(), skills, zone: zone || 'caracas' })}>Entrar al tablero →</button>
        <div className="demo-note">El sistema <b>muestra y ordena</b> por cercanía y habilidad — no asigna. Tú tomas.</div>
      </div>
    </section>
  );
}

/* ====================================================================
   REPORTANTE
   ==================================================================== */
function Reportante({ reports, onSend }) {
  const [need, setNeed] = useState('');
  const [loc, setLoc] = useState('');
  const [zone, setZone] = useState('');
  const [note, setNote] = useState('');
  const recent = [...reports].sort((a, b) => b.created - a.created).slice(0, 4);
  return (
    <section className="view onboard">
      <div className="panel hero">
        <h2>Reportar una <span style={{ color: 'var(--ve-red)' }}>necesidad</span></h2>
        <p>No necesitas cuenta. Cuéntanos qué hace falta y dónde. Un coordinador lo revisa y, si es válido, lo convierte en una tarea para los voluntarios.</p>
      </div>
      <div className="panel" style={{ padding: 22, marginTop: 16 }}>
        <div className="field"><label>¿Qué hace falta?</label><input className="input" value={need} onChange={(e) => setNeed(e.target.value)} placeholder="Ej. Falta agua potable en un refugio" /></div>
        <div className="field"><label>¿Dónde?</label><input className="input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ej. Sector La Pastora, Caracas" /></div>
        <div className="field"><label>Zona (ayuda a priorizar)</label>
          <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">Elegir zona…</option>
            {ZONE_KEYS.map((z) => <option key={z} value={z}>{ZONES[z].name} · {ZONES[z].sector}</option>)}
          </select>
        </div>
        <div className="field"><label>Nota (opcional)</label><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalles que ayuden al coordinador a decidir…" /></div>
        <button className="btn btn-take btn-block" onClick={() => { if (!need.trim()) return; onSend({ need: need.trim(), loc: loc.trim(), zone: zone || 'caracas', note: note.trim() }); setNeed(''); setLoc(''); setZone(''); setNote(''); }}>📨 Enviar reporte</button>
      </div>
      {recent.length > 0 && (
        <>
          <div className="section-head"><span className="kicker">Avisos recientes</span><h2 style={{ fontSize: 15 }}>En el sistema</h2><div className="rule" /></div>
          <div>{recent.map((r) => (
            <div className="panel report-item" key={r.id}>
              <div className="ri">{r.status === 'convertido' ? '✅' : r.status === 'descartado' ? '⚪' : '🕓'}</div>
              <div className="rc"><b>{r.need}</b><div className="rl">📍 {r.loc}</div>
                <div className="rs">{r.status === 'convertido' ? 'Convertido en tarea' : r.status === 'descartado' ? 'Descartado' : 'En revisión'} · {ago(r.created)}</div></div>
            </div>
          ))}</div>
        </>
      )}
    </section>
  );
}

/* ====================================================================
   MODAL — crear tarea
   ==================================================================== */
function CreateModal({ prefill, onClose, onSave }) {
  const [title, setTitle] = useState(prefill?.need || '');
  const [prio, setPrio] = useState('media');
  const [need, setNeed] = useState(2);
  const [loc, setLoc] = useState(prefill?.loc || '');
  const [zone, setZone] = useState(prefill?.zone || 'caracas');
  const [skill, setSkill] = useState('');
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal panel">
        <h3>{prefill ? 'Validar y crear tarea' : 'Crear tarea'}</h3>
        <div className="sub">{prefill ? 'Desde reporte ciudadano' : 'Nueva tarea para el tablero'}</div>
        <div className="field"><label>Título (corto y accionable)</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Repartir agua" /></div>
        <div className="g2">
          <div className="field"><label>Prioridad</label><select className="input" value={prio} onChange={(e) => setPrio(e.target.value)}><option value="alta">🔴 Alta</option><option value="media">🟡 Media</option><option value="baja">🟢 Baja</option></select></div>
          <div className="field"><label>Cupos</label><input className="input" type="number" min="1" value={need} onChange={(e) => setNeed(e.target.value)} /></div>
        </div>
        <div className="field"><label>Ubicación</label><input className="input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Refugio, sector, dirección…" /></div>
        <div className="g2">
          <div className="field"><label>Zona</label><select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>{ZONE_KEYS.map((z) => <option key={z} value={z}>{ZONES[z].name}</option>)}</select></div>
          <div className="field"><label>Recurso requerido</label><select className="input" value={skill} onChange={(e) => setSkill(e.target.value)}><option value="">— ninguno —</option>{Object.entries(SKILLS).map(([k, s]) => <option key={k} value={k}>{s.icon} {s.label}</option>)}</select></div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-take" onClick={() => { if (!title.trim()) return; onSave({ title: title.trim(), prio, need, loc: loc.trim() || ZONES[zone].name, zone, skill: skill || null }, prefill); }}>{prefill ? '✓ Crear desde reporte' : 'Publicar tarea'}</button>
        </div>
      </div>
    </div>
  );
}

/* ---- Empty ---- */
function Empty({ title, sub }) {
  return <div className="panel empty"><div className="big">🛰️</div><div style={{ color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 6 }}>{title}</div>{sub}</div>;
}
