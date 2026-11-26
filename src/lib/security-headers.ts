// Cabeceras de seguridad HTTP para todas las páginas (ADR 0024).
// SOC 2 CC6.6 · ISO 27001 A.8.26 (requisitos de seguridad de aplicaciones).
//
// Son defensa en profundidad: React ya escapa todo el texto, así que hoy no
// conocemos ningún XSS. Si algún día se colara uno, la CSP limita qué puede
// cargar y a dónde puede mandar datos.
//
// Es TypeScript puro (sin Next.js) para poder testearlo; `next.config.ts` lo usa.

export type SecurityHeader = { key: string; value: string };

// El origen de Supabase (`https://xxxx.supabase.co`) a partir de la URL del
// proyecto. Si falta o no es una URL https válida, no se agrega nada: la app
// guarda solo en el navegador (ADR 0013).
export function supabaseOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

export function buildContentSecurityPolicy(options: {
  supabaseUrl: string | undefined;
  isDev: boolean;
}): string {
  const supabase = supabaseOrigin(options.supabaseUrl);
  const directives = [
    // Por defecto, solo nuestro propio dominio.
    "default-src 'self'",
    // Next.js mete scripts inline para hidratar la página; sin nonces (que
    // obligarían a renderizar todo en cada petición) hace falta
    // 'unsafe-inline'. En desarrollo, React usa eval para depurar.
    `script-src 'self' 'unsafe-inline'${options.isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    // next/font descarga las fuentes al compilar y las sirve desde el dominio.
    "font-src 'self'",
    // A dónde puede hablar el JavaScript: el propio dominio y Supabase.
    `connect-src 'self'${supabase ? ` ${supabase}` : ""}`,
    // Nada de <object>/<embed> (plugins viejos).
    "object-src 'none'",
    // Impide cambiar la URL base de los enlaces relativos.
    "base-uri 'self'",
    // Los formularios solo se envían al propio dominio.
    "form-action 'self'",
    // Nadie puede meter la app en un iframe (clickjacking).
    "frame-ancestors 'none'",
    // En producción, cualquier http:// se pide como https://.
    ...(options.isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function buildSecurityHeaders(options: {
  supabaseUrl: string | undefined;
  isDev: boolean;
}): SecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(options),
    },
    // Lo mismo que frame-ancestors, para navegadores viejos.
    { key: "X-Frame-Options", value: "DENY" },
    // El navegador no "adivina" el tipo de un archivo: un .txt no se ejecuta
    // como script.
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Al seguir un enlace a otro sitio, solo se manda el dominio, no la ruta
    // completa (que incluye el id del personaje).
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // La app no usa cámara, micrófono, ubicación ni pagos: se apagan.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ];
}
