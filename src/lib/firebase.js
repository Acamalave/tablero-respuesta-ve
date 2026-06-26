'use client';
/* ---------------------------------------------------------------
   Firebase — inicialización del SDK web (cliente).
   Las claves NEXT_PUBLIC_* son públicas por diseño; el acceso lo
   controlan las Security Rules de Firestore. Se incluye fallback
   para que el build funcione sin configurar env vars en Vercel.
   --------------------------------------------------------------- */
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY || 'AIzaSyDXdORxDQ6OMG2vVM5uP5Kd5T9axUZfp64',
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN || 'tablero-respuesta-ve.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID || 'tablero-respuesta-ve',
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET || 'tablero-respuesta-ve.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID || '874598173540',
  appId: process.env.NEXT_PUBLIC_FB_APP_ID || '1:874598173540:web:a7b91404b2bc700111c871',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ── App Check (anti-abuso / anti-bots) ──────────────────────────────────────
// Exige que las peticiones a Firestore vengan de la app real (atestación con
// reCAPTCHA v3), no de scripts/curl. La clave de sitio reCAPTCHA es PÚBLICA.
// Mientras esté vacía, App Check no se inicializa (seguro desplegar sin clave).
const APPCHECK_SITE_KEY = process.env.NEXT_PUBLIC_APPCHECK_KEY || '6LefuzUtAAAAAF5dhhhHqSzPYXZdsvkGa3JSMn4R';
if (typeof window !== 'undefined' && APPCHECK_SITE_KEY) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    // No romper la app si App Check falla al inicializar.
    console.warn('App Check no se pudo inicializar:', e?.message || e);
  }
}

// Firestore con caché local persistente → offline-first real (IndexedDB).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);
