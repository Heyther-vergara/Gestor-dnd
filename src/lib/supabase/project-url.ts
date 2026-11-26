// La URL base del proyecto de Supabase (`https://xxxx.supabase.co`).
//
// supabase-js le agrega a esta URL `/rest/v1`, `/auth/v1`, etc. Si en la
// variable de entorno se pega la URL de la API REST (`…/rest/v1/`), que es la
// que muestra el panel en algunos lugares, todo queda mal armado
// (`…/rest/v1/auth/v1/authorize`) y falla en silencio. Por eso nos quedamos
// solo con el origen: protocolo + dominio (+ puerto).
//
// Devuelve null si falta o no es una URL http(s): entonces la app guarda solo
// en el navegador (ADR 0013).
export function supabaseProjectUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}
