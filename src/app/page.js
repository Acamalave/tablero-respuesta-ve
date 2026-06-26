'use client';
/* =====================================================================
   TABLERO DE RESPUESTA · VE — App principal (Next.js + Firebase)
   Perfil unificado: una persona (nombre, teléfono, cédula) puede AYUDAR
   como voluntario y/o REPORTAR. El perfil es el mismo y cuenta ambas.
   ===================================================================== */
import { useEffect, useMemo, useState, useCallback } from 'react';
import TaskCard from './components/TaskCard';
import TaskDetail from './components/TaskDetail';
import MyTaskCard from './components/MyTaskCard';
import TacticalMap from './components/TacticalMap';
import RealMapPicker from './components/RealMapPicker';
import {
  ZONES, ZONE_KEYS, SKILLS, PRIOS, PRIO_ORDER,
  dist, kmTo, fmtKm, taskState, avatarFor, prioBg, ago, COORD_NAME, COORD_PHONE,
} from '@/lib/model';
import * as store from '@/lib/store';

const USER_KEY = 'tablero_user_v1';
const ADMIN_KEY = 'tablero_admin_v1';
const MODE_KEY = 'tablero_mode_v1';   // 'voluntario' | 'reportante'
const VIEW_KEY = 'tablero_view_v1';   // 'usuario' | 'coordinador' (última pantalla)
const WELCOME_KEY = 'tablero_welcome_v1'; // bienvenida mostrada (solo la primera vez)
const VISIT_KEY = 'tablero_visit_v1';     // ya se registró la visita única
// Código de acceso del coordinador (solo la organización). Cámbialo aquí.
const ADMIN_CODE = 'acacio';

// Semilla de demo SOLO en desarrollo (localhost). En producción la app
// nunca crea tareas/voluntarios ficticios — arranca con datos reales.
const SEED_ENABLED =
  typeof window !== 'undefined' &&
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(window.location.hostname);

// Dos tarjetas de entrada; ambas usan el MISMO perfil unificado.
const ROLES = [
  { key: 'voluntario', icon: '🙋', title: 'Voluntario', desc: 'Veo tareas abiertas cerca de mí y tomo la que puedo hacer.', rc: '#E0A800', rcbg: '#fef6da', go: 'Quiero ayudar' },
  { key: 'reportante', icon: '📢', title: 'Reportar', desc: 'Aviso de una necesidad para que la organización la atienda.', rc: '#E4002B', rcbg: '#ffeef1', go: 'Reportar algo' },
];

export default function Page() {
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState(null);
  const [role, setRole] = useState(null);          // null | 'coordinador' | 'usuario'
  const [mode, setMode] = useState(() => {         // 'voluntario' | 'reportante' (recordado)
    try { return localStorage.getItem(MODE_KEY) || 'voluntario'; } catch { return 'voluntario'; }
  });
  const [tasks, setTasks] = useState([]);          // página del tablero (tareas activas)
  const [boardLast, setBoardLast] = useState(null); // cursor de paginación
  const [boardMore, setBoardMore] = useState(false);
  const [myTasks, setMyTasks] = useState([]);      // tareas del voluntario
  const [reports, setReports] = useState([]);      // reportes pendientes (coordinador)
  const [myReports, setMyReports] = useState([]);  // reportes del usuario
  const [volunteers, setVolunteers] = useState([]);
  const [suggestions, setSuggestions] = useState([]); // sugerencias (coordinador)
  const [announcements, setAnnouncements] = useState([]); // info para difundir
  const [announceModal, setAnnounceModal] = useState(null); // admin: null | {} (nuevo) | anuncio (editar)
  const [visitsCount, setVisitsCount] = useState(0);  // KPI: personas únicas que ingresaron
  const [suggestModal, setSuggestModal] = useState(false); // usuario: enviar sugerencia
  const [detailVol, setDetailVol] = useState(null);   // coordinador: perfil en vista previa
  const [stats, setStats] = useState({ abiertas: 0, encurso: 0, completadas: 0, pend: 0 });
  const [me, setMe] = useState({});                // perfil propio (contadores)
  const [refreshing, setRefreshing] = useState(false);
  const [online] = useState(true);
  const [coordTab, setCoordTab] = useState('tablero');
  const [volView, setVolView] = useState('board');  // 'board' | 'completadas'
  const [helpers, setHelpers] = useState(0); // conteo REAL de voluntarios registrados
  const [user, setUser] = useState(null);
  const [coord, setCoord] = useState({ name: COORD_NAME, phone: COORD_PHONE }); // contacto del coordinador (editable)
  const [editProfile, setEditProfile] = useState(false);
  const [editCoord, setEditCoord] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false); // bienvenida (primera vez)
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

  // Arranque: SIN listeners de colección (regla #1). Carga bajo demanda.
  useEffect(() => {
    (async () => {
      store.tryAnonAuth();
      const myUid = store.clientUid();
      setUid(myUid);
      if (SEED_ENABLED) { try { await store.seedIfEmpty(); } catch {} }
      try { const c = await store.fetchCoordContact(); if (c && c.phone) setCoord(c); } catch {}
      try { const n = await store.fetchHelpersCount(); setHelpers(n); } catch {}
      try { if (!localStorage.getItem(VISIT_KEY)) { await store.recordVisit(myUid); localStorage.setItem(VISIT_KEY, '1'); } } catch {}
      try {
        const saved = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        const admin = localStorage.getItem(ADMIN_KEY) === '1';
        if (admin) setIsAdmin(true);
        if (saved) { setUser({ ...saved, uid: myUid }); store.upsertVolunteer({ ...saved, uid: myUid }); }
        const savedView = localStorage.getItem(VIEW_KEY);
        if (savedView === 'coordinador' && admin) setRole('coordinador');
        else if (saved) setRole('usuario');
        if (!localStorage.getItem(WELCOME_KEY)) setShowWelcome(true); // primera visita
      } catch {}
      setReady(true);
    })();
    const tick = setInterval(() => forceTick((n) => n + 1), 60000); // solo refresca "hace X min"
    return () => clearInterval(tick);
  }, []);

  // Recordar pantalla/modo (para no volver siempre al home al refrescar)
  useEffect(() => { if (role) { try { localStorage.setItem(VIEW_KEY, role); } catch {} } }, [role]);
  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch {} }, [mode]);

  // Móvil: vuelve al tope al cambiar de pantalla / pestaña / aceptar tarea / registrarse.
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [role, mode, volView, coordTab, user, ready]);

  const counters = { done: me.done || 0, reports: me.reports || 0 };

  // Carga bajo demanda según la pantalla activa (lee solo lo necesario).
  const refresh = useCallback(async () => {
    if (!ready || !role) return;
    setRefreshing(true);
    try {
      if (role === 'coordinador') {
        const [board, st, vc, hc, anns] = await Promise.all([store.fetchBoard(), store.fetchStats(), store.fetchVisitsCount(), store.fetchHelpersCount(), store.fetchAnnouncements()]);
        setTasks(board.rows); setBoardLast(board.last); setBoardMore(board.more); setStats(st); setVisitsCount(vc); setHelpers(hc); setAnnouncements(anns);
        if (coordTab === 'reportes') setReports(await store.fetchPendingReports());
        else if (coordTab === 'voluntarios') setVolunteers(await store.fetchVolunteers());
        else if (coordTab === 'sugerencias') setSuggestions(await store.fetchSuggestions());
      } else if (role === 'usuario' && uid) {
        const meDoc = await store.fetchUser(uid); if (meDoc) setMe(meDoc);
        if (mode === 'voluntario') {
          const [board, mt, anns] = await Promise.all([store.fetchBoard(), store.fetchMyTasks(uid), store.fetchAnnouncements()]);
          setTasks(board.rows); setBoardLast(board.last); setBoardMore(board.more); setMyTasks(mt); setAnnouncements(anns);
        } else {
          setMyReports(await store.fetchMyReports(uid));
        }
      }
    } catch { /* offline: la caché local sirve los últimos datos */ }
    finally { setRefreshing(false); }
  }, [ready, role, mode, coordTab, uid]);

  // Refresca al cambiar de pantalla + auto-refresco largo SOLO en primer plano (regla #1).
  useEffect(() => {
    if (!ready || !role) return;
    refresh();
    const id = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') refresh();
    }, 90000);
    return () => clearInterval(id);
  }, [ready, role, mode, coordTab, refresh]);

  const loadMore = useCallback(async () => {
    if (!boardMore) return;
    const board = await store.fetchBoard(boardLast);
    setTasks((prev) => [...prev, ...board.rows]); setBoardLast(board.last); setBoardMore(board.more);
  }, [boardMore, boardLast]);

  const requestGeo = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoState('denied'); return; }
    setGeoState('asking');
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoState('on'); },
      () => setGeoState('denied'),
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 300000 }
    );
  }, []);

  const h = {
    take: async (id) => {
      try {
        const r = await store.takeTask(id, { name: user.name, uid });
        if (r === 'ok') { pushToast('Tomaste esta tarea', 'Aquí la tienes con su estado y el contacto.', '✅', 'Confirmado'); }
        await refresh();
      } catch (e) {
        if (String(e.message).includes('cupo')) pushToast('Cupo lleno', 'Otra persona tomó el último cupo.', '⚠️', 'Aviso');
      }
    },
    start: async (id) => { await store.startTask(id, uid); await refresh(); },
    complete: async (id) => { await store.completeTask(id, uid); await store.bumpVolunteerDone(uid); await refresh(); pushToast('¡Tarea completada!', 'Suma a tus ayudas. Gracias por responder.', '🎉', 'Logrado'); },
    release: async (id) => { await store.releaseTask(id, uid); await refresh(); pushToast('Tarea liberada', 'Vuelve a estar disponible para otro voluntario.', '↩️', 'Aviso'); },
    cyclePrio: async (id, cur) => { await store.cyclePrio(id, cur); await refresh(); },
    cancel: async (id) => { await store.cancelTask(id); await refresh(); pushToast('Tarea cerrada', 'Salió del tablero activo.', '🗑️', 'Coordinador'); },
    // Coordinador: cancela la asignación de UNA persona; la tarea vuelve a estar disponible.
    unassign: async (id, targetUid, name) => { await store.releaseTask(id, targetUid); await refresh(); pushToast('Asignación cancelada', `${name || 'La persona'} ya no tiene esta tarea — vuelve a estar disponible.`, '↩️', 'Coordinador'); },
  };

  const sendReport = async (data) => {
    const id = await store.createReport({ ...data, uid, reporterName: user.name, reporterPhone: user.phone, reporterCedula: user.cedula });
    await store.bumpReports(uid);
    await refresh();
    pushToast('Reporte enviado', 'Un coordinador lo está verificando.', '📨', 'Reporte');
    return id;
  };

  const register = async (profile) => {
    // Anti-duplicados: si ya existe un perfil con esa cédula, lo recuperamos.
    const existing = await store.findByCedula(profile.cedula);
    if (existing && existing.id !== uid) {
      const ruid = existing.id;
      store.setClientUid(ruid); setUid(ruid);
      const full = { ...profile, uid: ruid };
      try { localStorage.setItem(USER_KEY, JSON.stringify(full)); } catch {}
      setUser(full);
      await store.upsertVolunteer(full);   // actualiza el perfil existente (no duplica)
      await refresh();
      pushToast('Recuperamos tu perfil', 'Ya existía un perfil con esa cédula; lo actualizamos en lugar de crear uno repetido.', '✅', 'Listo');
      return;
    }
    try { localStorage.setItem(USER_KEY, JSON.stringify(profile)); } catch {}
    const full = { ...profile, uid };
    setUser(full);
    await store.upsertVolunteer({ ...full, done: 0, reports: 0 });
    await refresh();
    pushToast('¡Perfil creado!', 'Ya puedes ayudar y reportar con el mismo perfil.', '🙌', 'Bienvenido');
  };

  // Editar perfil del usuario (contacto + habilidades + zona)
  const saveProfile = async (profile) => {
    try { localStorage.setItem(USER_KEY, JSON.stringify(profile)); } catch {}
    const full = { ...profile, uid };
    setUser(full);
    await store.upsertVolunteer(full);   // no toca done/reports
    setEditProfile(false);
    await refresh();
    pushToast('Perfil actualizado', 'Tus datos se guardaron correctamente.', '✅', 'Perfil');
  };

  // Editar el contacto del coordinador (lo ven los voluntarios)
  const saveCoord = async (c) => {
    await store.saveCoordContact(c);
    setCoord(c);
    setEditCoord(false);
    pushToast('Contacto actualizado', 'El contacto del coordinador se guardó.', '✅', 'Coordinador');
  };

  // Usuario envía una sugerencia al coordinador
  const sendSuggestion = async (text) => {
    await store.createSuggestion({ text, name: user?.name || '', uid });
    setSuggestModal(false);
    pushToast('¡Gracias por tu sugerencia!', 'La coordinación la revisará para mejorar la app.', '💡', 'Enviado');
  };

  // Coordinador: crear / editar / quitar tarjetas de información (difundir)
  const saveAnnouncement = async (text, id) => {
    if (id) await store.updateAnnouncement(id, text);
    else await store.createAnnouncement(text);
    setAnnounceModal(null);
    await refresh();
    pushToast(id ? 'Información actualizada' : 'Información publicada', id ? 'Se guardaron los cambios.' : 'Ya aparece entre las tareas para difundir.', '📢', 'Coordinador');
  };
  const removeAnnouncement = async (id) => {
    await store.hideAnnouncement(id);
    setAnnouncements((a) => a.filter((x) => x.id !== id));
    pushToast('Información quitada', 'Ya no se muestra.', '✅', 'Coordinador');
  };

  // Coordinador edita el perfil de OTRA persona (desde la vista previa)
  const saveVolunteerAdmin = async (profile, targetUid) => {
    await store.upsertVolunteer({ ...profile, uid: targetUid });
    setDetailVol((d) => (d ? { ...d, ...profile } : d));
    setVolunteers((vs) => vs.map((v) => (v.id === targetUid ? { ...v, ...profile } : v)));
    pushToast('Perfil actualizado', 'Los datos de la persona se guardaron.', '✅', 'Coordinador');
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={() => setRole(null)} title="Volver al inicio">
          <span className="flag"><img src="/logo.jpg" alt="Tarea: Venezuela" width="40" height="40" /></span>
          <div className="brand-txt">
            <h1>TAREA: <b>VENEZUELA</b></h1>
            <span>Coordinación de tareas</span>
          </div>
        </div>
        <div className="topbar-spacer" />
        {role && <button className="role-back" onClick={refresh} disabled={refreshing} title="Actualizar el tablero">
          <span className="pin" style={{ display: 'inline-block', animation: refreshing ? 'spin .8s linear infinite' : 'none' }}>↻</span>
          <span className="rb-text">{refreshing ? 'Actualizando' : 'Actualizar'}</span>
        </button>}
        {/* Contador de voluntarios oculto por ahora (cambiar `false` por `helpers > 0` para reactivar) */}
        {false && helpers > 0 && (
          <div className="netchip live" title="Voluntarios registrados para ayudar">
            <span className="dot" />
            <span>{helpers.toLocaleString('es-VE')} {helpers === 1 ? 'voluntario' : 'voluntarios'}</span>
          </div>
        )}
      </header>

      <main>
        {!ready ? (
          <div className="boot"><div><div className="ring" /><div className="txt">Conectando con el tablero…</div></div></div>
        ) : !role ? (
          <RoleLanding
            onPick={(r) => { setRole('usuario'); setMode(r); setVolView('board'); }}
            isAdmin={isAdmin}
            onCoordinator={() => { if (isAdmin) { setRole('coordinador'); setCoordTab('tablero'); } else setAdminGate(true); }}
          />
        ) : role === 'coordinador' ? (
          <Coordinador {...{ tasks, reports, volunteers, suggestions, visitsCount, registered: helpers, stats, boardMore, loadMore, coordTab, setCoordTab, h, coord, announcements, isAdmin, onAddInfo: () => setAnnounceModal({}), onEditInfo: (a) => setAnnounceModal(a), onRemoveInfo: removeAnnouncement, onEditCoord: () => setEditCoord(true), onOpenVol: setDetailVol, onSuggestStatus: async (id, st) => { await store.setSuggestionStatus(id, st); setSuggestions((s) => s.map((x) => (x.id === id ? { ...x, status: st } : x))); }, openCreate: (p) => setModal({ prefill: p || null }), onConvert: (r) => setModal({ prefill: r }), onDiscard: async (id) => { await store.setReportStatus(id, 'descartado'); refresh(); } }} />
        ) : user ? (
          <Usuario {...{ user: { ...user, uid }, counters, mode, setMode, tasks, myTasks, myReports, boardMore, loadMore, uid, online, volView, setVolView, h, coord, announcements, isAdmin, onEditInfo: (a) => setAnnounceModal(a), onRemoveInfo: removeAnnouncement, onEditProfile: () => setEditProfile(true), onSuggest: () => setSuggestModal(true), onSendReport: sendReport, userPos, geoState, requestGeo }} />
        ) : (
          <Registro initialMode={mode} onDone={register} />
        )}
      </main>

      {role && (
        <div className="home-disclaimer" style={{ marginTop: 28 }}>
          <span className="hd-flag">🇻🇪</span>
          <p>
            En estos momentos se requiere toda la <b>organización y responsabilidad</b> posible.
            Si no puedes atender o ayudar, lo entendemos — pero <b>sé responsable con el uso</b> de
            esta herramienta: detrás de cada tarea hay personas reales. <b className="hd-strong">Venezuela nos necesita.</b>
          </p>
        </div>
      )}

      {showWelcome && <WelcomeModal onClose={() => { try { localStorage.setItem(WELCOME_KEY, '1'); } catch {} setShowWelcome(false); }} />}
      {editProfile && user && <EditProfileModal user={user} onClose={() => setEditProfile(false)} onSave={saveProfile} />}
      {editCoord && <CoordContactModal coord={coord} onClose={() => setEditCoord(false)} onSave={saveCoord} />}
      {suggestModal && <SuggestionModal onClose={() => setSuggestModal(false)} onSend={sendSuggestion} />}
      {announceModal && <AnnounceModal initial={announceModal} onClose={() => setAnnounceModal(null)} onSave={saveAnnouncement} />}
      {detailVol && <VolunteerDetail vol={detailVol} onClose={() => setDetailVol(null)} onSave={saveVolunteerAdmin} />}

      {adminGate && <AdminGate onClose={() => setAdminGate(false)} onOk={() => {
        try { localStorage.setItem(ADMIN_KEY, '1'); } catch {}
        setIsAdmin(true); setAdminGate(false); setRole('coordinador'); setCoordTab('tablero');
      }} />}

      {modal && <CreateModal prefill={modal.prefill} onClose={() => setModal(null)} onSave={async (data, prefill) => {
        await store.createTask({ ...data, reporterName: prefill?.reporterName || '', reporterPhone: prefill?.reporterPhone || '' });
        if (prefill?.id) await store.setReportStatus(prefill.id, 'convertido');
        setModal(null);
        await refresh();
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
      {/* Bloque centrado vertical y horizontalmente */}
      <div className="landing-center">
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
      </div>

      {/* Pie: disclaimer + acceso discreto del coordinador (solo emoji) */}
      <div className="landing-bottom">
        <div className="home-disclaimer">
          <span className="hd-flag">🇻🇪</span>
          <p>
            En estos momentos se requiere toda la <b>organización y responsabilidad</b> posible.
            Si no puedes atender o ayudar, lo entendemos — pero <b>sé responsable con el uso</b> de
            esta herramienta: detrás de cada tarea hay personas reales. <b className="hd-strong">Venezuela nos necesita.</b>
          </p>
        </div>
        <button className={`admin-emoji ${isAdmin ? 'granted' : ''}`} onClick={onCoordinator} title="Acceso del coordinador" aria-label="Acceso del coordinador">
          {isAdmin ? '🧭' : '🔒'}
        </button>
      </div>
    </section>
  );
}

// Bienvenida — se muestra solo la PRIMERA vez. Explica objetivo y cómo funciona.
function WelcomeModal({ onClose }) {
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal welcome" role="dialog" aria-modal="true">
        <div className="wel-flag"><i className="y" /><i className="b" /><i className="r" /></div>
        <div className="wel-eyebrow">🇻🇪 Tarea: Venezuela</div>
        <h3>Ayuda organizada en la emergencia</h3>
        <p className="wel-goal">
          Conectamos a quienes <b>necesitan ayuda</b> con quienes <b>pueden darla</b>, de forma
          coordinada — para que la respuesta sea rápida, ordenada y sin esfuerzos duplicados.
        </p>
        <ul className="wel-steps">
          <li><span className="ic">🙋</span><div><b>Ayuda como voluntario</b><span>Mira las tareas cerca de ti y toma la que puedas cumplir. Verás su estado y el contacto.</span></div></li>
          <li><span className="ic">📢</span><div><b>Reporta una necesidad</b><span>¿Viste algo que requiere apoyo? Repórtalo y la coordinación lo convierte en una tarea.</span></div></li>
          <li><span className="ic">🧭</span><div><b>La coordinación organiza</b><span>Un equipo central verifica y prioriza todo para evitar caos y duplicados.</span></div></li>
        </ul>
        <p className="wel-note">Sé responsable: detrás de cada tarea hay <b>personas reales</b>. <b className="hd-strong">Venezuela nos necesita.</b></p>
        <button className="btn btn-take btn-block" onClick={onClose}>Entendido, empezar →</button>
      </div>
    </div>
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

// Selector de habilidades: opciones del catálogo + las que el usuario AGREGUE.
function SkillsPicker({ skills, setSkills }) {
  const [custom, setCustom] = useState('');
  const toggle = (k) => setSkills((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const customSkills = (skills || []).filter((s) => !SKILLS[s]); // las propias (no del catálogo)
  const addCustom = () => {
    const v = custom.trim().slice(0, 40);
    if (!v) return;
    const dup = (skills || []).some((s) => s.toLowerCase() === v.toLowerCase()) ||
      Object.values(SKILLS).some((x) => x.label.toLowerCase() === v.toLowerCase());
    if (!dup) setSkills((s) => [...(s || []), v]);
    setCustom('');
  };
  return (
    <>
      <div className="chips-note">Toca las que apliquen — y si falta alguna, <b>agrégala tú</b>.</div>
      <div className="chips two">
        {Object.entries(SKILLS).map(([k, s]) => (
          <div key={k} className={`chip ${skills.includes(k) ? 'on' : ''}`} onClick={() => toggle(k)}><span>{s.icon}</span>{s.label}</div>
        ))}
        {customSkills.map((s) => (
          <div key={s} className="chip on" onClick={() => toggle(s)} title="Quitar"><span>✨</span>{s}<b className="chip-x">×</b></div>
        ))}
      </div>
      <div className="skill-add">
        <input className="input" value={custom} maxLength={40} inputMode="text"
          placeholder="¿Otra cosa que puedes ofrecer? Escríbela…"
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={addCustom} disabled={!custom.trim()}>+ Agregar</button>
      </div>
    </>
  );
}

/* ====================================================================
   EDITAR PERFIL — el usuario cambia su contacto y lo que ofrece
   ==================================================================== */
function EditProfileModal({ user, onClose, onSave, title = 'Editar mis datos' }) {
  const [name, setName] = useState(user.name || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [cedula, setCedula] = useState(user.cedula || '');
  const [skills, setSkills] = useState(user.skills || []);
  const [zone, setZone] = useState(user.zone || '');
  const [touched, setTouched] = useState(false);

  const nameOk = name.trim().length >= 2;
  const phoneOk = phone.replace(/\D/g, '').length >= 7;
  const cedulaOk = cedula.replace(/\D/g, '').length >= 6;
  const valid = nameOk && phoneOk && cedulaOk;
  const submit = () => {
    if (!valid) { setTouched(true); return; }
    onSave({ name: name.trim(), phone: phone.trim(), cedula: cedula.trim(), skills, zone });
  };

  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal modal-scroll" style={{ maxWidth: 560 }}>
        <h3>{title}</h3>
        <div className="sub">Actualiza el contacto y lo que la persona puede ofrecer.</div>
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
          <label>¿Qué puedes hacer?</label>
          <SkillsPicker skills={skills} setSkills={setSkills} />
        </div>
        <div className="field">
          <label>Tu zona</label>
          <select className="input" value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">📍 Elegir zona…</option>
            {ZONE_KEYS.map((z) => <option key={z} value={z}>{ZONES[z].name} · {ZONES[z].sector}</option>)}
          </select>
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-take" onClick={submit} disabled={!valid}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

/* Contacto del coordinador (nombre + teléfono que ven los voluntarios) */
function CoordContactModal({ coord, onClose, onSave }) {
  const [name, setName] = useState(coord?.name || '');
  const [phone, setPhone] = useState(coord?.phone || '');
  const [touched, setTouched] = useState(false);
  const nameOk = name.trim().length >= 2;
  const phoneOk = phone.replace(/\D/g, '').length >= 7;
  const valid = nameOk && phoneOk;
  const submit = () => { if (!valid) { setTouched(true); return; } onSave({ name: name.trim(), phone: phone.trim() }); };

  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <h3>Contacto del coordinador</h3>
        <div className="sub">Es el contacto que ven los voluntarios para coordinar las tareas sin reportante.</div>
        <div className="field">
          <label>Nombre / organización</label>
          <input className={`input ${touched && !nameOk ? 'invalid' : ''}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Coord. Cáritas" autoFocus />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <input className={`input ${touched && !phoneOk ? 'invalid' : ''}`} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+58 412 1234567" inputMode="tel" />
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={!valid}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

// Usuario envía una sugerencia para mejorar la app.
function SuggestionModal({ onClose, onSend }) {
  const [text, setText] = useState('');
  const ok = text.trim().length >= 4;
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h3>💡 Enviar sugerencia</h3>
        <div className="sub">¿Cómo podemos mejorar la app? Tu idea llega directo a la coordinación.</div>
        <div className="field">
          <label>Tu sugerencia</label>
          <textarea className="input" rows={4} value={text} maxLength={1000} autoFocus
            onChange={(e) => setText(e.target.value)} placeholder="Escribe tu idea o lo que mejorarías…" />
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-take" disabled={!ok} onClick={() => onSend(text.trim())}>Enviar</button>
        </div>
      </div>
    </div>
  );
}

// Coordinador publica una tarjeta de información para difundir.
function AnnounceModal({ initial, onClose, onSave }) {
  const editing = !!(initial && initial.id);
  const [text, setText] = useState((initial && initial.text) || '');
  const ok = text.trim().length >= 4;
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <h3>📢 {editing ? 'Editar información' : 'Publicar información'}</h3>
        <div className="sub">Aparece como tarjeta destacada entre las tareas, para que la gente la difunda.</div>
        <div className="field">
          <label>Mensaje</label>
          <textarea className="input" rows={4} value={text} maxLength={800} autoFocus
            onChange={(e) => setText(e.target.value)} placeholder="Ej. El Coliseo X tiene capacidad e insumos para recibir pacientes. Difunde." />
        </div>
        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-take" disabled={!ok} onClick={() => onSave(text.trim(), editing ? initial.id : null)}>{editing ? 'Guardar cambios' : 'Publicar'}</button>
        </div>
      </div>
    </div>
  );
}

// Vista previa del perfil de una persona (coordinador): info + historial + editar.
function VolunteerDetail({ vol, onClose, onSave }) {
  const [tasks, setTasks] = useState(null); // null = cargando
  const [reports, setReports] = useState(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    let live = true;
    store.fetchVolunteerTasks(vol.uid).then((t) => { if (live) setTasks(t); }).catch(() => { if (live) setTasks([]); });
    store.fetchMyReports(vol.uid).then((r) => { if (live) setReports(r); }).catch(() => { if (live) setReports([]); });
    return () => { live = false; };
  }, [vol.uid]);
  const REP_LBL = { pendiente: 'Pendiente', convertido: 'Convertido en tarea', descartado: 'Descartado' };

  if (editing) {
    return <EditProfileModal user={vol} title={`Editar a ${vol.name}`} onClose={() => setEditing(false)}
      onSave={async (p) => { await onSave(p, vol.uid); setEditing(false); }} />;
  }
  return (
    <div className="modal-bg show" onClick={(e) => { if (e.target.classList.contains('modal-bg')) onClose(); }}>
      <div className="modal modal-scroll" style={{ maxWidth: 520 }}>
        <div className="vd-head">
          <div className="vd-av">{avatarFor(vol.name)}</div>
          <div><h3>{vol.name}</h3><div className="sub">📍 {ZONES[vol.zone]?.name || '—'} &nbsp;·&nbsp; 📞 {vol.phone || '—'} &nbsp;·&nbsp; 🪪 {vol.cedula || '—'}</div></div>
        </div>
        <div className="vd-stats">
          <div className="ps help"><b>{vol.done ?? 0}</b><span>Ayudas</span></div>
          <div className="ps rep"><b>{vol.reports ?? 0}</b><span>Reportes</span></div>
        </div>
        {(vol.skills || []).length > 0 && (
          <div className="vd-skills">{(vol.skills || []).map((s) => (
            <span className="chip on" key={s}><span>{SKILLS[s]?.icon || '✨'}</span>{SKILLS[s]?.label || s}</span>
          ))}</div>
        )}
        <div className="vd-section">Historial de tareas</div>
        {tasks === null
          ? <div className="vd-empty">Cargando…</div>
          : tasks.length === 0
            ? <div className="vd-empty">Aún no ha tomado tareas.</div>
            : <div className="vd-tasks">{tasks.map((t) => {
                const mine = (t.takenBy || []).find((x) => x.uid === vol.uid);
                const st = mine?.state || taskState(t);
                const lbl = { tomada: 'Tomada', curso: 'En curso', completada: 'Completada' }[st] || st;
                return (
                  <div className="vd-task" key={t.id}>
                    <span className={`vd-badge st-${st}`}>{lbl}</span>
                    <div className="vd-tinfo"><b>{t.title}</b><span>📍 {t.loc} · {ago(t.created)}</span></div>
                  </div>
                );
              })}</div>}

        <div className="vd-section">Reportes hechos</div>
        {reports === null
          ? <div className="vd-empty">Cargando…</div>
          : reports.length === 0
            ? <div className="vd-empty">No ha hecho reportes.</div>
            : <div className="vd-tasks">{reports.map((r) => (
                <div className="vd-task" key={r.id}>
                  <span className="vd-badge st-reporte">📢 {REP_LBL[r.status] || r.status}</span>
                  <div className="vd-tinfo"><b>{r.need}</b><span>📍 {r.loc} · {ago(r.created)}</span></div>
                </div>
              ))}</div>}

        <div className="actions">
          <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn-take" onClick={() => setEditing(true)}>✏️ Editar información</button>
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
          <SkillsPicker skills={skills} setSkills={setSkills} />
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
        <p className="privacy-note">
          🔒 <b>Privacidad:</b> tu nombre, teléfono y cédula se usan <b>solo</b> para coordinar la ayuda y que el equipo de respuesta pueda contactarte. No se publican ni se comparten con terceros ajenos a la coordinación. Al continuar, aceptas este uso.
        </p>
      </div>
    </section>
  );
}

/* ====================================================================
   USUARIO — perfil unificado con switch Ayudar / Reportar
   ==================================================================== */
function Usuario({ user, counters, mode, setMode, tasks, myTasks, myReports, boardMore, loadMore, online, volView, setVolView, h, coord, announcements, isAdmin, onEditInfo, onRemoveInfo, onEditProfile, onSuggest, onSendReport, userPos, geoState, requestGeo }) {
  // El contador de "Ayudas" lleva a las tareas completadas.
  const verCompletadas = () => { setMode('voluntario'); setVolView('completadas'); };
  return (
    <section className="view">
      <div className="panel prof-head">
        <button className="prof-edit-ic" onClick={onEditProfile} title="Editar mis datos" aria-label="Editar mis datos">✏️</button>
        <div className="who">
          <b>{user.name}</b>
          <span>📞 {user.phone} &nbsp;·&nbsp; 🪪 {user.cedula}</span>
        </div>
        <div className="prof-stats">
          <button className="ps help" onClick={verCompletadas} title="Ver tus tareas completadas"><b>{counters.done}</b><span>Ayudas ›</span></button>
          <div className="ps rep"><b>{counters.reports}</b><span>Reportes</span></div>
        </div>
      </div>

      <div className="subtabs mode-switch">
        <button className={mode === 'voluntario' ? 'active' : ''} onClick={() => { setMode('voluntario'); setVolView('board'); }}>🙋 Ayudar</button>
        <button className={mode === 'reportante' ? 'active' : ''} onClick={() => setMode('reportante')}>📢 Reportar</button>
      </div>

      {mode === 'voluntario'
        ? <VolunteerArea tasks={tasks} myTasks={myTasks} boardMore={boardMore} loadMore={loadMore} user={user} online={online} volView={volView} setVolView={setVolView} h={h} coord={coord} announcements={announcements} isAdmin={isAdmin} onEditInfo={onEditInfo} onRemoveInfo={onRemoveInfo} userPos={userPos} geoState={geoState} requestGeo={requestGeo} />
        : <ReportArea myReports={myReports} onSend={onSendReport} onSwitch={() => setMode('voluntario')} userPos={userPos} requestGeo={requestGeo} />}

      <div className="suggest-cta">
        <span>¿Una idea para mejorar la app?</span>
        <button className="btn btn-ghost btn-sm" onClick={onSuggest}>💡 Enviar sugerencia</button>
      </div>
    </section>
  );
}

function VolunteerArea({ tasks, myTasks, boardMore, loadMore, user, online, volView, setVolView, h, coord, announcements, isAdmin, onEditInfo, onRemoveInfo, userPos, geoState, requestGeo }) {
  const [openId, setOpenId] = useState(null);
  const [liveActive, setLiveActive] = useState(null); // tarea en foco en TIEMPO REAL
  const [shown, setShown] = useState(5);              // muestra 5, "cargar más" suma 5
  const [celebrate, setCelebrate] = useState(false);  // mensaje motivador al completar

  // Pide ubicación al entrar al tablero (si no se ha intentado).
  useEffect(() => { if (geoState === 'idle') requestGeo(); }, [geoState, requestGeo]);

  // Tablero = página de tareas activas del servidor, sin las que ya tomé. Orden en cliente.
  const board = useMemo(() => {
    const ref = user.zone;
    return (tasks || [])
      .filter((t) => !(t.takerUids || []).includes(user.uid))
      .map((t) => {
        const km = userPos ? kmTo(userPos, t.zone) : null;
        const proximity = km != null ? km : (ref ? dist(ref, t.zone) : 50);
        return { t, km, proximity, skillMatch: (user.skills || []).includes(t.skill) ? 0 : 1 };
      })
      .sort((a, b) => PRIO_ORDER[a.t.prio] - PRIO_ORDER[b.t.prio] || a.proximity - b.proximity || a.skillMatch - b.skillMatch || b.t.created - a.t.created);
  }, [tasks, user, userPos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mis tareas = consulta directa por uid (array-contains).
  const mine = useMemo(() => (myTasks || [])
    .map((t) => ({ t, mine: (t.takenBy || []).find((x) => x.uid === user.uid && x.state !== 'soltada') }))
    .filter((o) => o.mine)
    .sort((a, b) => (PHASE_ORDER[a.mine.state] - PHASE_ORDER[b.mine.state]) || b.t.created - a.t.created),
  [myTasks, user.uid]);

  const openTask = board.find((o) => o.t.id === openId);
  const active = mine.find((o) => o.mine.state === 'tomada' || o.mine.state === 'curso');
  const done = mine.filter((o) => o.mine.state === 'completada');

  // Tiempo real (excepción permitida): escucha SOLO la tarea en foco.
  const activeId = active?.t.id;
  useEffect(() => {
    if (!activeId) { setLiveActive(null); return undefined; }
    const unsub = store.subTask(activeId, (d) => setLiveActive(d));
    return () => unsub && unsub();
  }, [activeId]);

  // Datos en vivo de la tarea en foco (cae al valor cargado si aún no llega).
  const activeT = (liveActive && liveActive.id === activeId) ? liveActive : active?.t;
  const activeMine = activeT
    ? (activeT.takenBy || []).find((x) => x.uid === user.uid && x.state !== 'soltada') || active?.mine
    : null;
  const activeCancelled = activeT && (activeT.status === 'cancelada' || activeT.state === 'cancelada');

  // Al completar: muestra el mensaje motivador (en vez de saltar al tablero).
  const hVol = { ...h, complete: async (id) => { await h.complete(id); setCelebrate(true); } };
  const verDisponibles = () => { setCelebrate(false); setVolView('board'); };

  // 1) Mensaje motivador tras completar
  if (celebrate) {
    return (
      <div className="panel celebrate">
        <div className="cel-emoji">🎉</div>
        <h2>¡Gracias por tu ayuda!</h2>
        <p>Acabas de completar una tarea y eso marca una diferencia real. Cada acción cuenta y hay gente que hoy está mejor por ti. <b>Venezuela te necesita</b> — ¿seguimos ayudando?</p>
        <button className="btn btn-take" onClick={verDisponibles}>🙋 Ver tareas disponibles</button>
      </div>
    );
  }

  // 2) Tarea en foco (una a la vez)
  if (active) {
    return activeCancelled ? (
      <div className="focus-note" style={{ background: 'var(--p-alta-bg)', borderColor: '#f6c9d4', color: 'var(--p-alta)' }}>
        <span>⚠️</span><span>El coordinador canceló esta tarea. Pulsa <b>Actualizar</b> para ver otras.</span>
      </div>
    ) : (
      <>
        <div className="focus-note"><span>🎯</span><span>Tienes una tarea en curso. Su estado se actualiza en tiempo real. Termínala o déjala para ver otras.</span></div>
        <div className="task-grid"><MyTaskCard t={activeT} mine={activeMine} online={online} h={hVol} coordName={coord?.name} coordPhone={coord?.phone} /></div>
      </>
    );
  }

  // 3) Tareas completadas (se llega desde el contador "Ayudas")
  if (volView === 'completadas') {
    return (
      <>
        <div className="section-head"><span className="kicker">Tu aporte</span><h2 style={{ fontSize: 17 }}>Tareas completadas</h2><div className="rule" />
          <button className="btn btn-primary btn-sm" onClick={verDisponibles}>🙋 Ver tareas disponibles</button></div>
        {done.length
          ? <div className="task-grid">{done.map((o, i) => <MyTaskCard key={o.t.id} t={o.t} mine={o.mine} online={online} h={hVol} i={i} coordName={coord?.name} coordPhone={coord?.phone} />)}</div>
          : <Empty title="Aún no has completado tareas" sub="Toma una tarea disponible y aparecerá aquí cuando la termines." />}
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <button className="btn btn-take" onClick={verDisponibles}>🙋 Ver tareas disponibles</button>
        </div>
      </>
    );
  }

  // 4) Tablero (vista por defecto): siempre las tareas por hacer
  return (
    <>
      <InfoList announcements={announcements} isAdmin={isAdmin} onEdit={onEditInfo} onRemove={onRemoveInfo} />
      {!userPos && (
        <div style={{ marginBottom: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={requestGeo}>{geoState === 'asking' ? '📍 Ubicando…' : '📍 Usar mi ubicación para ver distancias'}</button>
        </div>
      )}
      {board.length
        ? <div className="task-grid">{board.slice(0, shown).map((o, i) => (
            <TaskCard key={o.t.id} t={o.t} mode="vol" i={i} h={hVol} distanceLabel={o.km != null ? fmtKm(o.km) : null} onOpen={() => setOpenId(o.t.id)} />
          ))}</div>
        : <ExampleBoard />}
      {board.length > 0 && (shown < board.length || boardMore) && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { setShown((s) => s + 5); if (shown + 5 >= board.length && boardMore) loadMore(); }}>
            Cargar más tareas
          </button>
        </div>
      )}
      {openTask && <TaskDetail t={openTask.t} mode="vol" distanceLabel={openTask.km != null ? fmtKm(openTask.km) : null} h={hVol} onClose={() => setOpenId(null)} />}
    </>
  );
}
const PHASE_ORDER = { curso: 0, tomada: 1, completada: 2 };

const REPORT_KEY = 'tablero_lastreport_v1';

function ReportArea({ myReports, onSend, onSwitch, userPos, requestGeo }) {
  const [need, setNeed] = useState('');
  const [loc, setLoc] = useState('');
  const [zone, setZone] = useState('');
  const [coords, setCoords] = useState(null);   // {lat,lng} si marca su ubicación exacta
  const [note, setNote] = useState('');
  const [geoMsg, setGeoMsg] = useState('');
  const [sentId, setSentId] = useState(() => { try { return localStorage.getItem(REPORT_KEY) || null; } catch { return null; } });
  const [sentReport, setSentReport] = useState(null);
  const mine = [...(myReports || [])];

  // Tiempo real del reporte enviado: el ciudadano ve cuándo es evaluado.
  useEffect(() => {
    if (!sentId) { setSentReport(null); return undefined; }
    const unsub = store.subReport(sentId, (d) => setSentReport(d));
    return () => unsub && unsub();
  }, [sentId]);

  const nearestZone = (lat, lng) => {
    let best = null, bestKm = Infinity;
    for (const z of ZONE_KEYS) { const km = kmTo({ lat, lng }, z); if (km < bestKm) { bestKm = km; best = z; } }
    return best;
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es&zoom=18`);
      const j = await r.json();
      return j.display_name || '';
    } catch { return ''; }
  };

  // Aplica una ubicación (del mapa o del GPS): marca coords, zona y dirección.
  const applyLocation = async (lat, lng) => {
    setCoords({ lat, lng });
    setZone(nearestZone(lat, lng));
    setGeoMsg('📍 Ubicación exacta marcada');
    const addr = await reverseGeocode(lat, lng);
    if (addr && !loc.trim()) setLoc(addr);
  };

  const useMyLocation = () => {
    if (userPos) { applyLocation(userPos.lat, userPos.lng); return; }
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoMsg('No se pudo obtener la ubicación'); return; }
    setGeoMsg('Ubicando…');
    navigator.geolocation.getCurrentPosition((p) => applyLocation(p.coords.latitude, p.coords.longitude), () => setGeoMsg('Permiso de ubicación denegado'), { enableHighAccuracy: true, timeout: 9000 });
    if (requestGeo) requestGeo();
  };

  const submit = async () => {
    if (!need.trim()) return;
    const id = await onSend({ need: need.trim(), loc: loc.trim(), zone: zone || 'caracas', note: note.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null });
    setNeed(''); setLoc(''); setZone(''); setCoords(null); setNote(''); setGeoMsg('');
    if (id) { setSentId(id); try { localStorage.setItem(REPORT_KEY, id); } catch {} }
  };

  const reportAnother = () => { setSentId(null); try { localStorage.removeItem(REPORT_KEY); } catch {} };

  // Pantalla de verificación: se mantiene hasta que el coordinador la evalúe.
  if (sentId) {
    const r = sentReport;
    const status = r?.status || 'pendiente';
    const pend = status === 'pendiente';
    const ok = status === 'convertido';
    return (
      <div className="panel verify">
        {pend ? <div className="ring" /> : <div className="verify-ic">{ok ? '✅' : '⚪'}</div>}
        <h2>{pend ? 'Verificando tu reporte' : ok ? '¡Reporte aprobado!' : 'Reporte revisado'}</h2>
        <p>{pend
          ? 'Un coordinador está revisando la información. En cuanto la evalúe, lo verás aquí mismo. Gracias por avisar con responsabilidad.'
          : ok
            ? 'Tu reporte se convirtió en una tarea para los voluntarios. ¡Gracias por avisar!'
            : 'El coordinador revisó tu reporte y no lo convirtió en tarea esta vez. Puedes reportar otro caso.'}</p>
        {r && <div className="verify-card"><b>{r.need}</b><span>📍 {r.loc} · {ago(r.created)}</span></div>}
        <div className="verify-actions">
          <button className="btn btn-take" onClick={reportAnother}>📢 Reportar otro caso</button>
          <button className="btn btn-ghost" onClick={onSwitch}>🙋 Cambiar a voluntario</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel" style={{ padding: 22 }}>
        <div className="field"><label>¿Qué hace falta?</label><input className="input" value={need} onChange={(e) => setNeed(e.target.value)} placeholder="Ej. Falta agua potable en un refugio" /></div>
        <div className="field"><label>¿Dónde? <span className="hint">dirección o referencia</span></label><input className="input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Ej. Sector La Pastora, Caracas" /></div>
        <div className="field">
          <label>Marca el lugar exacto en el mapa <span className="hint">toca el punto donde se necesita</span></label>
          <RealMapPicker value={coords} onPick={(p) => applyLocation(p.lat, p.lng)} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={useMyLocation}>📍 Usar mi ubicación actual</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ve-blue)' }}>
              {coords ? `📍 Ubicación marcada${zone ? ` · ${ZONES[zone].name}` : ''}` : (geoMsg || 'Toca el mapa para marcar')}
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
function Coordinador({ tasks, reports, volunteers, suggestions, visitsCount, registered, stats, boardMore, loadMore, coordTab, setCoordTab, h, coord, announcements, isAdmin, onAddInfo, onEditInfo, onRemoveInfo, onEditCoord, onOpenVol, onSuggestStatus, openCreate, onConvert, onDiscard }) {
  const newSugg = suggestions.filter((s) => s.status === 'nueva').length;
  return (
    <section className="view">
      <div className="section-head">
        <span className="kicker">Panel del coordinador</span><h2>Operación</h2><div className="rule" />
        <button className="btn btn-ghost btn-sm" onClick={onEditCoord}>✏️ Mi contacto</button>
        <button className="btn btn-ghost btn-sm" onClick={onAddInfo}>📢 Información</button>
        <button className="btn btn-primary btn-sm" onClick={() => openCreate()}>➕ Crear tarea</button>
      </div>
      <div className="coord-contact-line">📞 Contacto que ven los voluntarios: <b>{coord?.name}</b> · {coord?.phone}</div>
      <div className="stats stats-6">
        <Stat n={visitsCount} l="Personas únicas" a="var(--ve-blue)" />
        <Stat n={registered} l="Registradas" a="var(--p-baja)" />
        <Stat n={stats.abiertas} l="Abiertas" a="var(--p-baja)" />
        <Stat n={stats.encurso} l="En curso" a="var(--p-media)" />
        <Stat n={stats.completadas} l="Completadas" a="var(--ink-faint)" />
        <Stat n={stats.pend} l="Por revisar" a="var(--ve-red)" />
      </div>
      <div className="subtabs">
        {[['tablero', '🗂️ Tablero'], ['voluntarios', '👥 Personas'], ['reportes', '📥 Reportes'], ['sugerencias', '💡 Sugerencias'], ['mapa', '🗺️ Mapa']].map(([k, lbl]) => (
          <button key={k} className={coordTab === k ? 'active' : ''} onClick={() => setCoordTab(k)}>
            {lbl}
            {k === 'reportes' && stats.pend > 0 && <span className="count">{stats.pend}</span>}
            {k === 'sugerencias' && newSugg > 0 && <span className="count">{newSugg}</span>}
          </button>
        ))}
      </div>
      {coordTab === 'tablero' && <CoordBoard tasks={tasks} h={h} boardMore={boardMore} loadMore={loadMore} announcements={announcements} isAdmin={isAdmin} onEditInfo={onEditInfo} onRemoveInfo={onRemoveInfo} />}
      {coordTab === 'voluntarios' && <Roster volunteers={volunteers} onOpen={onOpenVol} />}
      {coordTab === 'mapa' && <TacticalMap tasks={tasks} />}
      {coordTab === 'reportes' && <Inbox reports={reports} onConvert={onConvert} onDiscard={onDiscard} />}
      {coordTab === 'sugerencias' && <SuggestionsList suggestions={suggestions} onStatus={onSuggestStatus} />}
    </section>
  );
}

function Stat({ n, l, a }) {
  return <div className="stat" style={{ '--accent': a }}><div className="num">{n}</div><div className="lbl">{l}</div></div>;
}

function CoordBoard({ tasks, h, boardMore, loadMore, announcements, isAdmin, onEditInfo, onRemoveInfo }) {
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
      <InfoList announcements={announcements} isAdmin={isAdmin} onEdit={onEditInfo} onRemove={onRemoveInfo} />
      {groups.some(Boolean) ? groups : <Empty title="Sin tareas activas" sub="Crea la primera tarea para empezar a coordinar." />}
      {boardMore && <div style={{ textAlign: 'center', marginTop: 8 }}><button className="btn btn-ghost btn-sm" onClick={loadMore}>Cargar más tareas</button></div>}
      {openTask && <TaskDetail t={openTask} mode="coord" h={h} onClose={() => setOpenId(null)} />}
    </>
  );
}

function Roster({ volunteers, onOpen }) {
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(20);
  const norm = (s) => (s || '').toLowerCase();
  const query = norm(q.trim());
  const digits = (s) => (s || '').replace(/\D/g, '');
  const filtered = query
    ? volunteers.filter((v) => norm(v.name).includes(query) || (digits(v.cedula).includes(digits(query)) && digits(query)))
    : volunteers;
  const list = filtered.slice(0, shown);
  return (
    <div>
      <div className="roster-bar">
        <span className="rs-ic">🔎</span>
        <input className="input roster-search" value={q} placeholder="Buscar por nombre o cédula…"
          onChange={(e) => { setQ(e.target.value); setShown(20); }} />
        {q && <button className="rs-clear" onClick={() => setQ('')} aria-label="Limpiar">✕</button>}
      </div>
      <div className="roster-head">👥 <b>{filtered.length}</b> {query ? 'encontradas' : 'personas registradas'}. Toca a una para ver su perfil.</div>
      {!filtered.length
        ? <Empty title={query ? 'Sin resultados' : 'Sin personas aún'} sub={query ? 'Prueba con otro nombre o cédula.' : 'Aparecerán al registrarse.'} />
        : <div className="roster-list">
            {list.map((v) => (
              <button className="rrow" key={v.id} onClick={() => onOpen({ ...v, uid: v.id })}>
                <span className="rav">{avatarFor(v.name)}</span>
                <span className="rmain">
                  <b>{v.name}</b>
                  <span className="rmeta">📍 {ZONES[v.zone]?.name || '—'}{v.cedula ? ` · ${v.cedula}` : ''}</span>
                </span>
                <span className="rsk">{(v.skills || []).slice(0, 5).map((s) => <i key={s} title={SKILLS[s]?.label || s}>{SKILLS[s]?.icon || '✨'}</i>)}</span>
                <span className="rct"><b>{v.done ?? 0}</b> ayudas</span>
                <span className="rarr">›</span>
              </button>
            ))}
          </div>}
      {filtered.length > shown && (
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShown((s) => s + 20)}>Cargar más ({filtered.length - shown})</button>
        </div>
      )}
    </div>
  );
}

// Sugerencias enviadas por los usuarios.
function SuggestionsList({ suggestions, onStatus }) {
  const list = [...suggestions].sort((a, b) => (b.created || 0) - (a.created || 0));
  if (!list.length) return <Empty title="Sin sugerencias aún" sub="Aquí verás las ideas que envíen los usuarios para mejorar la app." />;
  return (
    <div className="sugg-list">
      {list.map((s) => (
        <div className={`panel sugg-item ${s.status === 'nueva' ? 'nueva' : ''}`} key={s.id}>
          <div className="sugg-ic">💡</div>
          <div className="sugg-c">
            <p>{s.text}</p>
            <div className="sugg-meta">{s.name ? `${s.name} · ` : ''}{ago(s.created)}{s.status === 'atendida' ? ' · ✓ atendida' : ''}</div>
          </div>
          {s.status !== 'atendida'
            ? <button className="btn btn-ghost btn-sm" onClick={() => onStatus(s.id, 'atendida')}>Marcar atendida</button>
            : <button className="btn btn-ghost btn-sm" onClick={() => onStatus(s.id, 'nueva')}>Reabrir</button>}
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

// Tarjetas de INFORMACIÓN para difundir (tono distinto, resaltan entre las tareas).
function InfoList({ announcements, isAdmin, onEdit, onRemove }) {
  if (!announcements || !announcements.length) return null;
  return (
    <div className="info-stack">
      {announcements.map((a) => <InfoCard key={a.id} a={a} isAdmin={isAdmin} onEdit={onEdit} onRemove={onRemove} />)}
    </div>
  );
}
function InfoCard({ a, isAdmin, onEdit, onRemove }) {
  const wa = `https://wa.me/?text=${encodeURIComponent(`${a.text}\n\n📲 Súmate y ayuda en Tarea: Venezuela → https://tareavenezuela.com`)}`;
  return (
    <div className="info-card">
      <div className="info-head">
        <span className="info-tag">📢 Información · para difundir</span>
        {isAdmin && (
          <span className="info-acts">
            <button className="info-x" onClick={() => onEdit(a)} title="Editar información" aria-label="Editar">✏️</button>
            <button className="info-x" onClick={() => onRemove(a.id)} title="Quitar información" aria-label="Quitar">✕</button>
          </span>
        )}
      </div>
      <p className="info-text">{a.text}</p>
      <a className="btn btn-wa btn-sm" href={wa} target="_blank" rel="noopener noreferrer">💬 Difundir por WhatsApp</a>
    </div>
  );
}

// Ejemplos de necesidades (cuando aún no hay tareas reales) — orienta al usuario.
const EXAMPLE_TASKS = [
  { title: 'Repartir agua potable', loc: 'Refugio o sector sin servicio', prio: 'alta', skill: 'vehiculo' },
  { title: 'Trasladar medicinas', loc: 'Farmacia → familia que lo necesita', prio: 'alta', skill: 'vehiculo' },
  { title: 'Despejar escombros de una vía', loc: 'Calle o acceso bloqueado', prio: 'media', skill: 'fuerza' },
  { title: 'Cocinar para un refugio', loc: 'Albergue temporal', prio: 'media', skill: 'cocina' },
  { title: 'Acompañar a adultos mayores', loc: 'Refugio o vivienda', prio: 'baja', skill: 'primeros' },
  { title: 'Rescatar o cuidar mascotas', loc: 'Zona afectada', prio: 'baja', skill: 'mascotas' },
];

function ExampleBoard() {
  return (
    <div className="examples">
      <div className="ex-note">
        <span className="ex-ic">🔎</span>
        <div>
          <b>Estas tarjetas son solo ejemplos</b>, para que veas cómo se verán las tareas. Estamos <b>verificando necesidades reales cerca de ti</b> — aparecerán aquí muy pronto. Mientras tanto, si ves algo que requiere ayuda, <b>repórtalo</b> 📢.
        </div>
      </div>
      <div className="task-grid">
        {EXAMPLE_TASKS.map((e, i) => (
          <article className="task tidy example" data-prio={e.prio} key={i} style={{ animationDelay: `${i * 45}ms` }}>
            <span className="spine" />
            <div className="body">
              <div className="top">
                <div className="title">{e.title}</div>
                <span className="ex-tag">Ejemplo</span>
              </div>
              <div className="loc">{e.loc}</div>
              <div className="facts">
                <span className="ex-prio" style={{ color: PRIOS[e.prio].color, background: prioBg(e.prio) }}>{PRIOS[e.prio].label}</span>
                <span className="skill">{SKILLS[e.skill].icon} {SKILLS[e.skill].label}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="ex-cta">¿Viste una necesidad así? Toca <b>📢 Reportar</b> arriba para avisar a la coordinación.</div>
    </div>
  );
}
