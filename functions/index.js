/* ======================================================================
   Cloud Functions — Pagos con tarjeta VERIFICADOS (Plan C)
   ----------------------------------------------------------------------
   Pasarela: PagueloFácil (Enlace de Pago / LinkDeamon).

   Flujo:
   1) La app llama a  POST /pf/create  con { amount, donorUid, donorName }.
      -> Creamos el cobro en PagueloFácil con el código de comercio (CCLW,
         guardado como SECRETO) y devolvemos la URL de checkout (un solo uso).
   2) El donante paga en el checkout de PagueloFácil (en USD).
   3) PagueloFácil hace un POST con el resultado a  /pf/return  (RETURN_URL).
      -> Verificamos la operación de forma INDEPENDIENTE contra la API de
         PagueloFácil y, sólo si se confirma, escribimos el aporte en
         Firestore con verified:true (el Admin SDK omite las reglas, así que
         un cliente NUNCA puede falsificar un aporte verificado).
   4) Redirigimos al donante de vuelta a la app con el resultado.

   SECRETOS (no van en el código ni en git). Configurar antes de desplegar:
     firebase functions:secrets:set PF_CCLW     # Código web del comercio
     firebase functions:secrets:set PF_TOKEN    # Token de API REST (verificación)

   NOTA: el endpoint REST de verificación (verifyOperation) debe confirmarse
   contra la documentación/colección Postman oficial con las credenciales
   reales al momento de desplegar. Mientras no se confirme la aprobación, el
   aporte se guarda como pendiente (verified:false) — nunca como verificado.
   ====================================================================== */
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const PF_CCLW = defineSecret('PF_CCLW');    // Código web del comercio (PagueloFácil)
const PF_TOKEN = defineSecret('PF_TOKEN');  // Token de API REST (verificación independiente)

const REGION = 'us-central1';
const APP_URL = 'https://tablero-respuesta-ve.web.app';
const RETURN_URL = `${APP_URL}/pf/return`;
const PF_LINK_URL = 'https://secure.paguelofacil.com/LinkDeamon.cfm';

// PagueloFácil exige el RETURN_URL codificado en hexadecimal.
const toHex = (s) => Buffer.from(s, 'utf8').toString('hex');

/* 1) Crear cobro → devuelve la URL de checkout (un solo uso). */
exports.createCardPayment = onRequest(
  { secrets: [PF_CCLW], cors: true, region: REGION },
  async (req, res) => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
      const { amount, donorUid } = req.body || {};
      const amt = Math.round(parseFloat(amount) * 100) / 100;
      if (!amt || amt < 1 || amt > 10000) return res.status(400).json({ error: 'monto' });

      const params = new URLSearchParams({
        CCLW: PF_CCLW.value(),
        CMTN: amt.toFixed(2),
        CDSC: 'Aporte a Tarea: Venezuela',
        RETURN_URL: toHex(RETURN_URL),
        CARD_TYPE: 'CARD',
        PARM_1: (donorUid || '').toString().slice(0, 60),
        EXPIRES_IN: '1800',
      });
      const r = await fetch(PF_LINK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      const j = await r.json().catch(() => null);
      const url = j && j.data && j.data.url;
      if (!url) { logger.error('PagueloFácil sin URL de checkout', j); return res.status(502).json({ error: 'pf' }); }
      return res.json({ url });
    } catch (e) {
      logger.error('createCardPayment', e);
      return res.status(500).json({ error: 'server' });
    }
  }
);

/* 2) Resultado de PagueloFácil (RETURN_URL) → verificar y registrar. */
exports.pfReturn = onRequest(
  { secrets: [PF_TOKEN], region: REGION },
  async (req, res) => {
    const p = Object.assign({}, req.query || {}, req.body || {});
    const estado = (p.Estado || '').toString();
    const oper = (p.Oper || '').toString();
    const total = parseFloat(p.TotalPagado || '0') || 0;
    const donorUid = (p.PARM_1 || '').toString().slice(0, 60);
    const approved = /aprob/i.test(estado) && total > 0;

    try {
      if (approved && oper) {
        // Verificación independiente: sólo verified:true si la API confirma.
        const confirmed = await verifyOperation(oper, PF_TOKEN.value());
        await db.collection('donations').add({
          donorUid: donorUid || null,
          donorName: (p.Usuario || '').toString().slice(0, 120),
          method: 'tarjeta',
          amount: `$${total.toFixed(2)}`,
          reference: oper,
          verified: confirmed === true,
          pending: confirmed !== true,
          oper,
          paidUsd: total,
          created: Date.now(),
        });
      }
    } catch (e) {
      logger.error('pfReturn write', e);
    }
    return res.redirect(302, `${APP_URL}/?aporte=${approved ? 'ok' : 'no'}`);
  }
);

/* Confirma una operación contra la API REST de PagueloFácil (anti-falsificación).
   TODO(deploy): confirmar endpoint y formato con la colección Postman oficial
   y las credenciales reales. Falla en cerrado: si no confirma, devuelve false. */
async function verifyOperation(oper, token) {
  if (!token) return false;
  try {
    const r = await fetch(
      `https://secure.paguelofacil.com/rest/transaction/status?oper=${encodeURIComponent(oper)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) return false;
    const j = await r.json().catch(() => null);
    if (!j) return false;
    const st = (j.status != null ? j.status : (j.data && j.data.status) || '').toString().toLowerCase();
    return st === '1' || st === 'aprobada' || st === 'approved' || j.approved === true;
  } catch {
    return false;
  }
}
