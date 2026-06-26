import './globals.css';

const DESC =
  'Coordinación de tareas para la respuesta al desastre. La organización coordina; la gente toma tareas y ayuda.';

export const metadata = {
  metadataBase: new URL('https://tareavenezuela.com'),
  title: 'Tarea: Venezuela',
  description: DESC,
  manifest: '/manifest.webmanifest',
  applicationName: 'Tarea: Venezuela',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tarea: Venezuela' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon.svg' },
  formatDetection: { telephone: false },
  // Vista previa al compartir (WhatsApp, redes).
  openGraph: {
    type: 'website',
    locale: 'es_VE',
    url: 'https://tareavenezuela.com',
    siteName: 'Tarea: Venezuela',
    title: 'Tarea: Venezuela — Respuesta coordinada al desastre',
    description: DESC,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Tarea: Venezuela' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tarea: Venezuela — Respuesta coordinada al desastre',
    description: DESC,
    images: ['/og.png'],
  },
};

// Bloquea el zoom (sensación de app nativa) + tema claro.
export const viewport = {
  themeColor: '#eef2f8',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
