'use client';
/* =====================================================================
   TABLERO DE RESPUESTA · VE — App principal (Next.js + Firebase)
   Perfil unificado: una persona (nombre, teléfono, cédula) puede AYUDAR
   como voluntario y/o REPORTAR. El perfil es el mismo y cuenta ambas.
   ===================================================================== */
import { useEffect, useMemo, useState, useCallback } from 'react';
import Flag from './components/Flag';
import TaskCard from './components/TaskCard';
import TaskDetail from './components/TaskDetail';
import MyTaskCard from './components/MyTaskCard';
import TacticalMap from './components/TacticalMap';
import ZonePickerMap from './components/ZonePickerMap';
import {
  ZONES, ZONE_KEYS, SKILLS, PRIOS, PRIO_ORDER,
  dist, kmTo, fmtKm, taskState, avatarFor, prioBg, ago, COORD_CONTACT,
} from '@/lib/model';
import * as store from '@/lib/store';

const USER_KEY = 'tablero_user_v1';
const ADMIN_KEY = 'tablero_admin_v1';
const MODE_KEY = 'tablero_mode_v1';   // 'voluntario' | 'reportante'
const VIEW_KEY = 'tablero_view_v1';   // 'usuario' | 'coordinador' (última pantalla)
// Código de acceso del coordinador (solo la organización). Cámbialo aquí.
const ADMIN_CODE = 'acacio';

// Dos tarjetas de entrada; ambas usan el MISMO perfil unificado.
const ROLES = [
  { key: 'voluntario', icon: '🙋', title: 'Voluntario', desc: 'Veo tareas abiertas cerca de mí y tomo la que puedo hacer.', rc: '#E0A800', rcbg: '#fef6da', go: 'Quiero ayudar' },
  { key: 'reportante', icon: '📢', title: 'Reportar', desc: 'Aviso de una necesidad para que la organización la atienda.', rc: '#E4002B', rcbg: '#ffeef1', go: 'Reportar algo' },
];

export default function Page() {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState(null);
  const [role, setRole] = useState(null);          // null | 'coordinador' | 'usuario'
  const [mode, setMode] = useState('voluntario');  // 'voluntario' | 'reportante'
  const [tasks, setTasks] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [online, setOnline] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [coordTab, setCoordTab] = useState('tablero');
  const [volTab, setVolTab] = useState('tablero');
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminGate, setAdminGate] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const [userPos, setUserPos] = useState(null);     // {lat,lng} de geolocalización
  const [geoState, setGeoState] = useState('idle');  // idle | asking | on | denied
  const [, forceTick] = useState(0);

  const pushToast = useCallback((title, body, icon = '🔔', tag = 'Notificación') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, title, body, icon, tag }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  useEffect(() => {
    let unsubs = [];
    (async () => {
      store.tryAnonAuth();
      const myUid = store.clientUid();
      setUid(myUid);
      try { await store.seedIfEmpty(); } catch {}
      unsubs.push(store.subTasks((rows, meta) => { setTasks(rows); setFromCache(meta.fromCache); }));
      unsubs.push(store.subReports((rows) => setReports(rows)));
      unsubs.push(store.subVolunteers((rows) => setUsers(rows)));
      try {
        const saved = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        const admin = localStorage.getItem(ADMIN_KEY) === '1';
        if (admin) setIsAdmin(true);
        const savedMode = localStorage.getItem(MODE_KEY);
        if (savedMode) setMode(savedMode);
        if (saved) { setUser({ ...saved, uid: myUid }); store.upsertVolunteer({ ...saved, uid: myUid }); }
        // Recordar la última pantalla: el usuario registrado vuelve a la suya.
        const savedView = localStorage.getItem(VIEW_KEY);
        if (savedView === 'coordinador' && admin) setRole('coordinador');
        else if (saved) setRole('usuario');
      } catch {}
      setReady(true);
    })();
    const tick = setInterval(() => forceTick((n) => n + 1), 60000);
    return () => { unsubs.forEach((f) => f && f()); clearInterval(tick); };
  }, []);

  // Recordar pantalla/modo (para no volver siempre al home al refrescar)
  useEffect(() => { if (role) { try { localStorage.setItem(VIEW_KEY, role); } catch {} } }, [role]);
  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch {} }, [mode]);

  // Contadores en vivo del perfil
  const me = useMemo(() => users.find((v) => v.id === uid) || {}, [users, uid]);
  const counters = { done: me.done || 0, reports: me.reports || 0 };

  const requestGeo = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoState('denied'); return; }
    setGeoState('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoState('on'); },
      () => setGeoState('denied'),
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 }
    );
  }, []);

  async function toggleNet() {
    const next = !online;
    setOnline(next);
    if (next) { await store.goOnline(); pushToast('Conexión restablecida', 'Sincronizando cambios pendientes…', '📶', 'Red'); }
    else { await store.goOffline(); pushToast('Sin red', 'Tus acciones se guardan local y se sincronizan al reconectar.', '📴', 'Sin conexión'); }
  }

  const h = {
    take: async (id) => {
      try {
        const r = await store.takeTask(id, { name: user.name, uid });
        if (r === 'ok') { setVolTab('mis'); pushToast('Tomaste esta tarea', 'La encuentras en "Mis tareas" con sus fases.', '✅', online ? 'Confirmado' : 'Pendiente'); }
      } catch (e) {
        if (String(e.message).includes('cupo')) pushToast('Cupo lleno', 'Otra persona tomó el último cupo.', '⚠️', 'Aviso');
      }
    },
    start: (id) => store.startTask(id, uid),
    complete: async (id) => { await store.completeTask(id, uid); store.bumpVolunteerDone(uid); pushToast('¡Tarea completada!', 'Suma a tus ayudas. Gracias por responder.', '🎉', 'Logrado'); },
    release: async (id) => { await store.releaseTask(id, uid); pushToast('Tarea liberada', 'Vuelve a estar disponible para otro voluntario.', '↩️', 'Aviso'); },
    cyclePrio: (id, cur) => store.cyclePrio(id, cur),
    cancel: async (id) => { await store.cancelTask(id); pushToast('Tarea cerrada', 'Salió del tablero activo.', '🗑️', 'Coordinador'); },
  };

  const sendReport = async (data) => {
    await store.createReport({ ...data, uid, reporterName: user.name, reporterPhone: user.phone, reporterCedula: user.cedula });
    store.bumpReports(uid);
    pushToast('Reporte enviado', 'Un coordinador lo revisará pronto. Gracias por avisar.', '📨', 'Reporte');
  };

  const register = (profile) => {
    try { localStorage.setItem(USER_KEY, JSON.stringify(profile)); } catch {}
    const full = { ...profile, uid };
    setUser(full);
    store.upsertVolunteer({ ...full, done: 0, reports: 0 });
    pushToast('¡Perfil creado!', 'Ya puedes ayudar y reportar con el mismo perfil.', '🙌', 'Bienvenido');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => setRole(null)} title="Volver al inicio">
          <span className="flag"><Flag size={40} /></span>
          <div className="brand-txt">
            <h1>TABLERO DE <b>RESPUESTA</b></h1>
            <span>Coordinación · Venezuela</span>
          </div>
        </div>
        <div className="topbar-spacer" />
        {role && <button className="role-back" onClick={() => setRole(null)}><span className="pin">⇆</span><span className="rb-text">Inicio</span></button>}
        <button className={`netchip ${!online ? 'off' : fromCache ? 'syncing' : ''}`} onClick={toggleNet} title="Alternar conexión (offline-first)">
          <span className="dot" />
          <span>{online ? (fromCache ? 'Conectando' : 'En línea') : 'Sin red'}</span>
        </button>
      </header>

      <main>
        {!ready ? (
          <div className="boot"><div><div className="ring" /><div className="txt">Conectando con el tablero…</div></div></div>
        ) : !role ? (
          <RoleLanding
            onPick={(r) => { setRole('usuario'); setMode(r); setVolTab('tablero'); }}
            isAdmin={isAdmin}
            onCoordinator={() => { if (isAdmin) { setRole('coordinador'); setCoordTab('tablero'); } else setAdminGate(true); }}
          />
        ) : role === 'coordinador' ? (
          <Coordinador {...{ tasks, reports, volunteers: users, coordTab, setCoordTab, h, openCreate: (p) => setModal({ prefill: p || null }), onConvert: (r) => setModal({ prefill: r }), onDiscard: (id) => store.setReportStatus(id, 'descartado') }} />
        ) : user ? (
          <Usuario {...{ user: { ...user, uid }, counters, mode, setMode, tasks, reports, uid, online, volTab, setVolTab, h, onSendReport: sendReport, userPos, geoState, requestGeo }} />
        ) : (
          <Registro initialMode={mode} onDone={register} />
        )}
      </main>

      {role && <p className="demo-note">Tiempo real con <b>Firebase Firestore</b> · ábrela en dos ventanas y verás el tablero actualizarse en vivo · prueba <b>Sin red</b> para el modo offline</p>}

      {adminGate && <AdminGate onClose={() => setAdminGate(false)} onOk={() => {
        try { localStorage.setItem(ADMIN_KEY, '1'); } catch {}
        setIsAdmin(true); setAdminGate(false); setRole('coordinador'); setCoordTab('tablero');
      }} />}

      {modal && <CreateModal prefill={modal.prefill} onClose={() => setModal(null)} onSave={async (data, prefill) => {
        await store.createTask({ ...data, reporterName: prefill?.reporterName || '', reporterPhone: prefill?.reporterPhone || '' });
        if (prefill?.id) store.setReportStatus(prefill.id, 'convertido');
        setModal(null);
        pushToast('Tarea publicada', `“${data.title}” ya está en el tablero.`, '📡', 'Coordinador');
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
   PANTALLA INICIAL — selección (2 íconos) + disclaimer al fondo
   ==================================================================== */
function RoleLanding({ onPick, isAdmin, onCoordinator }) {
  return (
    <section className="landing view">
      <div className="landing-head">
        <div className="eyebrow">Respuesta coordinada al desastre</div>
        <h2>¿Cómo quieres ayudar?</h2>
        <p>Elige una opción para empezar.</p>
      </div>
      <div className="role-grid">
        {ROLES.map((r) => (
          <button key={r.key} className="role-card" style={{ '--rc': r.rc, '--rc-bg': r.rcbg }} onClick={() => onPick(r.key)}>
            <div className="ic">{r.icon}</div>
            <h3>{r.title}</h3>
            <p>{r.desc}</p>
            <span className="go">{r.go} <span className="arr">→</span></span>
          </button>
        ))}
      </div>
      <div className="admin-row">
        <button className={`admin-link ${isAdmin ? 'granted' : ''}`} onClick={onCoordinator}>
          {isAdmin ? '🧭 Entrar como coordinador' : '🔒 Acceso del coordinador'}
        </button>
      </div>
      <div className="home-disclaimer">
        <span className="hd-flag">🇻🇪</span>
        <p>
          En estos momentos se requiere toda la <b>organización y responsabilidad</b> posible.
          Si no puedes atender o ayudar, lo entendemos — pero <b>sé responsable con el uso</b> de
          esta herramienta: detrás de cada tarea hay personas reales. <b className="hd-strong">Venezuela nos necesita.</b>
        </p>
      </div>
    </section>
  );
}

function AdminGate({ onClose, onOk }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const submit = () => { if (pin.trim() === ADMIN_CODE) onOk(); else setErr(true); };
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <h3>Acceso del coordinador</h3>
        <div className="sub">Solo para la organización</div>
        <div className="field">
          <label>Código de acceso</label>
          <input className={`input ${err ? 'invalid' : ''}`} type="password" value={pin} autoFocus
            onChange={(e) => { setPin(e.target.value); setErr(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="••••••••" />
          {err && <div style={{ color: 'var(--ve-red)', fontSize: 12.5, marginTop: 8, fontWeight: 600 }}>Código incorrecto</div>}
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit}>Entrar</button>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   REGISTRO — perfil único (nombre, teléfono, cédula OBLIGATORIOS)
   ==================================================================== */
function Registro({ initialMode, onDone }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cedula, setCedula] = useState('');
  const [skills, setSkills] = useState([]);
  const [zone, setZone] = useState('');
  const [touched, setTouched] = useState(false);

  const nameOk = name.trim().length >= 2;
  const phoneOk = phone.replace(/\D/g, '').length >= 7;
  const cedulaOk = cedula.replace(/\D/g, '').length >= 6;
  const valid = nameOk && phoneOk && cedulaOk;
  const toggle = (k) => setSkills((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  return (
    <section className="view onboard">
      <div className="panel hero">
        <h2>Crea tu <span>perfil</span></h2>
        <p>{initialMode === 'reportante'
          ? 'Para dar formalidad a tu reporte necesitamos tus datos. Con el mismo perfil también podrás ayudar como voluntario.'
          : 'Para coordinar y poder confirmar contigo necesitamos tus datos. Con el mismo perfil podrás ayudar y reportar.'}</p>
      </div>
      <div className="panel" style={{ padding: 22, marginTop: 16 }}>
        <div className="field">
          <label>Nombre y apellido</label>
          <input className={`input ${touched && !nameOk ? 'invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Carlos Rodríguez" />
        </div>
        <div className="g2">
          <div className="field">
            <label>Teléfono</label>
            <input className={`input ${touched && !phoneOk ? 'invalid' : ''}`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 412 1234567" inputMode="tel" />
          </div>
          <div className="field">
            <label>Cédula</label>
            <input className={`input ${touched && !cedulaOk ? 'invalid' : ''}`} value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="V-12345678" inputMode="numeric" />
          </div>
        </div>
        <div className="field">
          <label>¿Qué puedes hacer? <span className="hint">opcional</span></label>
          <div className="chips">{Object.entries(SKILLS).map(([k, s]) => (
            <div key={k} className={`chip ${skills.includes(k) ? 'on' : ''}`} onClick={() => toggle(k)}><span>{s.icon}</span>{s.label}</div>
          ))}</div>
        </div>
        <div className="field">
          <label>Tu zona <span className="hint">opcional</span></label>
          <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">📍 Elegir zona…</option>
            {ZONE_KEYS.map((z) => <option key={z} value={z}>{ZONES[z].name} · {ZONES[z].sector}</option>)}
          </select>
        </div>
        <button className="btn btn-take btn-block" style={{ marginTop: 8 }} disabled={!valid}
          onClick={() => { setTouched(true); if (valid) onDone({ name: name.trim(), phone: phone.trim(), cedula: cedula.trim(), skills, zone: zone || 'caracas' }); }}>
          {valid ? 'Crear perfil y entrar →' : 'Completa nombre, teléfono y cédula'}
        </button>
        <div className="demo-note">Tus datos dan formalidad al reporte y permiten que la organización confirme contigo.</div>
      </div>
    </section>
  );
}

/* ====================================================================
   USUARIO — perfil unificado con switch Ayudar / Reportar
   ==================================================================== */
function Usuario({ user, counters, mode, setMode, tasks, reports, uid, online, volTab, setVolTab, h, onSendReport, userPos, geoState, requestGeo }) {
  return (
    <section className="view">
      <div className="panel prof-head">
        <div className="who"><b>{user.name}</b><span>📞 {user.phone} &nbsp;·&nbsp; 🪪 {user.cedula}</span></div>
        <div className="prof-stats">
          <div className="ps help"><b>{counters.done}</b><span>Ayudas</span></div>
          <div className="ps rep"><b>{counters.reports}</b><span>Reportes</span></div>
        </div>
      </div>

      <div className="subtabs mode-switch">
        <button className={mode === 'voluntario' ? 'active' : ''} onClick={() => setMode('voluntario')}>🙋 Ayudar</button>
        <button className={mode === 'reportante' ? 'active' : ''} onClick={() => setMode('reportante')}>📢 Reportar</button>
      </div>

      {mode === 'voluntario'
        ? <VolunteerArea tasks={tasks} user={user} online={online} volTab={volTab} setVolTab={setVolTab} h={h} userPos={userPos} geoState={geoState} requestGeo={requestGeo} />
        : <ReportArea reports={reports} uid={uid} onSend={onSendReport} onSwitch={() => setMode('voluntario')} userPos={userPos} requestGeo={requestGeo} />}
    </section>
  );
}

function VolunteerArea({ tasks, user, online, volTab, setVolTab, h, userPos, geoState, requestGeo }) {
  const [openId, setOpenId] = useState(null);
  const hasMine = (t) => (t.takenBy || []).some((x) => x.uid === user.uid && x.state !== 'soltada');

  // Pide ubicación al entrar al tablero (si no se ha intentado).
  useEffect(() => { if (geoState === 'idle') requestGeo(); }, [geoState, requestGeo]);

  const board = useMemo(() => {
    const ref = user.zone;
    return tasks
      .filter((t) => ['abierta', 'tomada', 'curso'].includes(taskState(t)) && !hasMine(t))
      .map((t) => {
        const km = userPos ? kmTo(userPos, t.zone) : null;
        const proximity = km != null ? km : (ref ? dist(ref, t.zone) : 50);
        return { t, km, proximity, skillMatch: (user.skills || []).includes(t.skill) ? 0 : 1 };
      })
      .sort((a, b) => PRIO_ORDER[a.t.prio] - PRIO_ORDER[b.t.prio] || a.proximity - b.proximity || a.skillMatch - b.skillMatch || b.t.created - a.t.created);
  }, [tasks, user, userPos]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(() => tasks
    .map((t) => ({ t, mine: (t.takenBy || []).find((x) => x.uid === user.uid && x.state !== 'soltada') }))
    .filter((o) => o.mine)
    .sort((a, b) => (PHASE_ORDER[a.mine.state] - PHASE_ORDER[b.mine.state]) || b.t.created - a.t.created),
  [tasks, user.uid]);

  const openTask = board.find((o) => o.t.id === openId);
  // Una tarea a la vez: si hay una en curso, el voluntario se enfoca en ella.
  const active = mine.find((o) => o.mine.state === 'tomada' || o.mine.state === 'curso');
  const done = mine.filter((o) => o.mine.state === 'completada');

  return (
    <>
      <div className="subtabs vol-tabs">
        <button className={volTab === 'tablero' ? 'active' : ''} onClick={() => setVolTab('tablero')}>🗂️ Tareas abiertas{!active && <span className="count">{board.length}</span>}</button>
        <button className={volTab === 'mis' ? 'active' : ''} onClick={() => setVolTab('mis')}>🎒 Mis tareas <span className="count">{active ? 1 : done.length}</span></button>
      </div>

      {active ? (
        // Foco en la tarea activa: aparece bajo el perfil hasta finalizar o dejarla.
        <>
          <div className="focus-note"><span>🎯</span><span>Tienes una tarea en curso. Termínala o déjala para ver y tomar otras.</span></div>
          <div className="task-grid"><MyTaskCard t={active.t} mine={active.mine} online={online} contact={COORD_CONTACT} h={h} /></div>
        </>
      ) : volTab === 'tablero' ? (
        <>
          {!userPos && (
            <div style={{ marginBottom: 14 }}>
              <button className="btn btn-ghost btn-sm" onClick={requestGeo}>{geoState === 'asking' ? '📍 Ubicando…' : '📍 Usar mi ubicación para ver distancias'}</button>
            </div>
          )}
          {board.length
            ? <div className="task-grid">{board.map((o, i) => (
                <TaskCard key={o.t.id} t={o.t} mode="vol" i={i} h={h} distanceLabel={o.km != null ? fmtKm(o.km) : null} onOpen={() => setOpenId(o.t.id)} />
              ))}</div>
            : <Empty title="Todo cubierto" sub="No hay tareas abiertas ahora mismo. Te avisaremos cuando surja una cerca de ti." />}
          {openTask && <TaskDetail t={openTask.t} mode="vol" distanceLabel={openTask.km != null ? fmtKm(openTask.km) : null} h={h} onClose={() => setOpenId(null)} />}
        </>
      ) : (
        done.length
          ? <div className="task-grid">{done.map((o, i) => <MyTaskCard key={o.t.id} t={o.t} mine={o.mine} online={online} contact={COORD_CONTACT} h={h} i={i} />)}</div>
          : <Empty title="Aún no has completado tareas" sub="Toma una tarea en “Tareas abiertas”. Aparecerá aquí con su estatus." />
      )}
    </>
  );
}
const PHASE_ORDER = { curso: 0, tomada: 1, completada: 2 };

function ReportArea({ reports, uid, onSend, onSwitch, userPos, requestGeo }) {
  const [need, setNeed] = useState('');
  const [loc, setLoc] = useState('');
  const [zone, setZone] = useState('');
  const [coords, setCoords] = useState(null);   // {lat,lng} si marca su ubicación exacta
  const [note, setNote] = useState('');
  const [geoMsg, setGeoMsg] = useState('');
  const mine = [...reports].filter((r) => r.reporterUid === uid).sort((a, b) => b.created - a.created);

  const nearestZone = (lat, lng) => {
    let best = null, bestKm = Infinity;
    for (const z of ZONE_KEYS) { const km = kmTo({ lat, lng }, z); if (km < bestKm) { bestKm = km; best = z; } }
    return best;
  };

  const useMyLocation = () => {
    const apply = (p) => { const c = { lat: p.coords.latitude, lng: p.coords.longitude }; setCoords(c); setZone(nearestZone(c.lat, c.lng)); setGeoMsg('📍 Ubicación marcada en el mapa'); };
    if (userPos) { setCoords(userPos); setZone(nearestZone(userPos.lat, userPos.lng)); setGeoMsg('📍 Ubicación marcada en el mapa'); return; }
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoMsg('No se pudo obtener la ubicación'); return; }
    setGeoMsg('Ubicando…');
    navigator.geolocation.getCurrentPosition(apply, () => setGeoMsg('Permiso de ubicación denegado'), { enableHighAccuracy: true, timeout: 9000 });
    if (requestGeo) requestGeo();
  };

  const submit = () => {
    if (!need.trim()) return;
    onSend({ need: need.trim(), loc: loc.trim(), zone: zone || 'caracas', note: note.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null });
    setNeed(''); setLoc(''); setZone(''); setCoords(null); setNote(''); setGeoMsg('');
  };

  return (
    <>
      <div className="panel" style={{ padding: 22 }}>
        <div className="field"><label>¿Qué hace falta?</label><input className="input" value={need} onChange={(e) => setNeed(e.target.value)} placeholder="Ej. Falta agua potable en un refugio" /></div>
        <div className="field"><label>¿Dónde? <span className="hint">dirección o referencia</span></label><input className="input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ej. Sector La Pastora, Caracas" /></div>
        <div className="field">
          <label>Ubicación en el mapa <span className="hint">toca tu zona</span></label>
          <ZonePickerMap value={zone} onPick={(z) => { setZone(z); setCoords(null); setGeoMsg(''); }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={useMyLocation}>📍 Usar mi ubicación actual</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ve-blue)' }}>
              {zone ? `Elegida: ${ZONES[zone].name}${geoMsg && coords ? ' · ' + geoMsg : ''}` : (geoMsg || 'Aún sin ubicación')}
            </span>
          </div>
        </div>
        <div className="field"><label>Nota <span className="hint">opcional</span></label><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalles que ayuden al coordinador…" /></div>
        <button className="btn btn-take btn-block" disabled={!need.trim()} onClick={submit}>📨 Enviar reporte</button>
        <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={onSwitch}>🙋 Prefiero ayudar como voluntario</button>
      </div>

      {mine.length > 0 && (
        <>
          <div className="section-head"><span className="kicker">Mis reportes</span><h2 style={{ fontSize: 16 }}>Enviados</h2><div className="rule" /></div>
          <div>{mine.map((r) => (
            <div className="panel report-item" key={r.id}>
              <div className="ri">{r.status === 'convertido' ? '✅' : r.status === 'descartado' ? '⚪' : '🕓'}</div>
              <div className="rc"><b>{r.need}</b><div className="rl">📍 {r.loc}</div>
                <div className="rs">{r.status === 'convertido' ? 'Convertido en tarea' : r.status === 'descartado' ? 'Descartado' : 'En revisión'} · {ago(r.created)}</div></div>
            </div>
          ))}</div>
        </>
      )}
    </>
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
        <Stat n={done} l="Completadas" a="var(--ink-faint)" />
        <Stat n={pend} l="Por revisar" a="var(--ve-red)" />
      </div>
      <div className="subtabs">
        {[['tablero', '🗂️ Tablero'], ['voluntarios', '👥 Personas'], ['mapa', '🗺️ Mapa'], ['reportes', '📥 Reportes']].map(([k, lbl]) => (
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
  const [openId, setOpenId] = useState(null);
  const openTask = tasks.find((t) => t.id === openId);
  const groups = ['alta', 'media', 'baja'].map((prio) => {
    const list = tasks.filter((t) => t.prio === prio && !['completada', 'cancelada'].includes(taskState(t))).sort((a, b) => b.created - a.created);
    if (!list.length) return null;
    return (
      <div className="prio-group" key={prio}>
        <div className="ph">
          <span className="pill" style={{ color: PRIOS[prio].color, background: prioBg(prio) }}>
            <span className="led" style={{ background: PRIOS[prio].led }} />{PRIOS[prio].label.toUpperCase()} · {list.length}
          </span>
        </div>
        <div className="task-grid">{list.map((t, i) => <TaskCard key={t.id} t={t} mode="coord" i={i} h={h} onOpen={() => setOpenId(t.id)} />)}</div>
      </div>
    );
  });
  return (
    <>
      {groups.some(Boolean) ? groups : <Empty title="Sin tareas activas" sub="Crea la primera tarea para empezar a coordinar." />}
      {openTask && <TaskDetail t={openTask} mode="coord" h={h} onClose={() => setOpenId(null)} />}
    </>
  );
}

function Roster({ volunteers }) {
  if (!volunteers.length) return <Empty title="Sin personas aún" sub="Aparecerán al registrarse." />;
  return (
    <div className="roster">
      {volunteers.map((v) => (
        <div className="panel vcard" key={v.id}>
          <div className="av">{avatarFor(v.name)}</div>
          <div>
            <div className="vn">{v.name}</div>
            <div className="vt">📍 {ZONES[v.zone]?.name || '—'}{v.cedula ? ` · 🪪 ${v.cedula}` : ''}</div>
            <div className="vsk">{(v.skills || []).map((s) => <i key={s} title={SKILLS[s]?.label}>{SKILLS[s]?.icon}</i>)}</div>
          </div>
          <div className="vct"><b>{v.done ?? 0}</b><span>ayudas</span></div>
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
            <div className="rl">📍 {r.loc}{r.lat != null && <span style={{ color: 'var(--ve-blue)', fontWeight: 600 }}> · ubicación marcada en mapa</span>}</div>
            {r.note && <div className="rn">“{r.note}”</div>}
            <div className="rs">{r.reporterName ? `Por ${r.reporterName}${r.reporterPhone ? ` · ${r.reporterPhone}` : ''}${r.reporterCedula ? ` · 🪪 ${r.reporterCedula}` : ''} · ` : ''}{ago(r.created)} · zona: {ZONES[r.zone]?.name || 'sin definir'}</div>
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
      <div className="modal">
        <h3>{prefill ? 'Validar y crear tarea' : 'Crear tarea'}</h3>
        <div className="sub">{prefill ? 'Desde reporte ciudadano' : 'Nueva tarea para el tablero'}</div>
        <div className="field"><label>Título</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Repartir agua" /></div>
        <div className="g2">
          <div className="field"><label>Prioridad</label><select className="input" value={prio} onChange={(e) => setPrio(e.target.value)}><option value="alta">🔴 Alta</option><option value="media">🟡 Media</option><option value="baja">🟢 Baja</option></select></div>
          <div className="field"><label>Cupos</label><input className="input" type="number" min="1" value={need} onChange={(e) => setNeed(e.target.value)} /></div>
        </div>
        <div className="field"><label>Ubicación</label><input className="input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Refugio, sector, dirección…" /></div>
        <div className="g2">
          <div className="field"><label>Zona</label><select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>{ZONE_KEYS.map((z) => <option key={z} value={z}>{ZONES[z].name}</option>)}</select></div>
          <div className="field"><label>Recurso</label><select className="input" value={skill} onChange={(e) => setSkill(e.target.value)}><option value="">— ninguno —</option>{Object.entries(SKILLS).map(([k, s]) => <option key={k} value={k}>{s.icon} {s.label}</option>)}</select></div>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-take" disabled={!title.trim()} onClick={() => { if (!title.trim()) return; onSave({ title: title.trim(), prio, need, loc: loc.trim() || ZONES[zone].name, zone, skill: skill || null }, prefill); }}>{prefill ? '✓ Crear' : 'Publicar tarea'}</button>
        </div>
      </div>
    </div>
  );
}

function Empty({ title, sub }) {
  return <div className="panel empty"><div className="big">🗺️</div><div className="et">{title}</div>{sub}</div>;
}
