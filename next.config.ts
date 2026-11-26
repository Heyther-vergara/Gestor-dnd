import type { NextConfig } from "next";

import { buildSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // No anunciar "X-Powered-By: Next.js": no le da pistas a quien busca
  // versiones con fallos conocidos (ADR 0024).
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Todas las rutas.
        source: "/:path*",
        headers: buildSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isDev: process.env.NODE_ENV === "development",
        }),
      },
    ];
  },
};

export default nextConfig;
