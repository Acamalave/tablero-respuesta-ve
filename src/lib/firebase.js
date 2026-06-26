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

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY || 'AIzaSyDXdORxDQ6OMG2vVM5uP5Kd5T9axUZfp64',
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN || 'tablero-respuesta-ve.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID || 'tablero-respuesta-ve',
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET || 'tablero-respuesta-ve.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID || '874598173540',
  appId: process.env.NEXT_PUBLIC_FB_APP_ID || '1:874598173540:web:a7b91404b2bc700111c871',
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Firestore con caché local persistente → offline-first real (IndexedDB).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);
