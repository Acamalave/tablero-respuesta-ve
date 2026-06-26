import './globals.css';

export const metadata = {
  title: 'Tarea: Venezuela',
  description:
    'Coordinación de tareas para la respuesta al desastre. La organización coordina; la gente toma tareas.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Tarea: Venezuela',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Tarea: Venezuela' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon.svg' },
  formatDetection: { telephone: false },
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
