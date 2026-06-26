import './globals.css';

export const metadata = {
  title: 'Tablero de Respuesta · VE',
  description:
    'Tablero vivo de coordinación de tareas para la respuesta al terremoto. La organización coordina; la gente toma tareas.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Respuesta VE',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Respuesta VE' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon.svg' },
};

export const viewport = {
  themeColor: '#05070d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
