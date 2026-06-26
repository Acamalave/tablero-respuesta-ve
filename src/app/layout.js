import './globals.css';

export const metadata = {
  title: 'Tablero de Respuesta · VE',
  description:
    'Tablero vivo de coordinación de tareas para la respuesta al terremoto. La organización coordina; la gente toma tareas.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Respuesta VE',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Respuesta VE' },
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
