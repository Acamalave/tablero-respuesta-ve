/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // App 100% del lado del cliente → export estático (desplegable a cualquier
  // hosting estático: Firebase Hosting, Vercel, etc.). Sin SSR ni billing.
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
