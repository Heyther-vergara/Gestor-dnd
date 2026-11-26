# 0024 — Cabeceras de seguridad HTTP

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

Paso 3 del hardening (ADR 0022). `next.config.ts` estaba vacío: la app no mandaba ninguna cabecera de seguridad. React ya escapa todo el texto y no conocemos ningún XSS, pero si algún día se colara uno no habría una segunda barrera. Además, cualquier sitio podía meter la app en un iframe (clickjacking).

Controles: SOC 2 CC6.6 · ISO 27001 A.8.26.

## Decisión

1. **Cabeceras en `next.config.ts`** para todas las rutas, armadas por una función pura y testeada (`src/lib/security-headers.ts`):
   - `Content-Security-Policy`: todo desde el propio dominio; `connect-src` solo al propio dominio y al origen de Supabase (sale de `NEXT_PUBLIC_SUPABASE_URL` al compilar); `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` y `upgrade-insecure-requests` en producción.
   - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy` sin cámara, micrófono, ubicación ni pagos.
   - `poweredByHeader: false`: no anunciar que la app usa Next.js.
2. **CSP sin nonces, con `'unsafe-inline'` en scripts y estilos.** Es la opción "Without Nonces" de la guía de Next.js 16. Los nonces obligan a renderizar cada página en cada petición (sin caché de CDN) y la app hoy no lo necesita; la ganancia principal (frame-ancestors, connect-src, object-src, base-uri) se consigue igual. `'unsafe-eval'` solo en desarrollo.
3. **Zod en modo `jitless`** (`src/rules-engine/schemas/common.ts`). Zod 4 prueba una vez si puede usar `new Function` para compilar esquemas; con esta CSP la prueba falla sin romper nada, pero el navegador la reporta como violación en cada página. `jitless` salta la prueba.

## Cómo se verificó

Build de producción con una URL de Supabase de prueba, y Playwright recorriendo `/`, `/characters`, `/characters/new`, `/sheet/example`, `/credits` y `/homebrew`: las fuentes cargan, los formularios responden y no hay ninguna violación de CSP (escuchando `securitypolicyviolation`).

## Consecuencias

- Si se agrega un servicio externo (analítica, imágenes de otro dominio, otra API), hay que sumarlo a la CSP o el navegador lo bloquea.
- En las vistas previas de Vercel, la barra de comentarios de Vercel puede no cargar, porque viene de otro dominio. No afecta a producción.
- `Strict-Transport-Security` no se agrega aquí: Vercel la manda por su cuenta en los dominios con HTTPS. Se revisa en la vista previa del PR; si faltara, se suma a esta lista.
- Pendiente para más adelante: CSP con nonces o con hashes (SRI, todavía experimental en Next 16) para quitar `'unsafe-inline'`.
