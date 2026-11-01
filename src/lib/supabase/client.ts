// Cliente de Supabase para el navegador (ADR 0013).
//
// Usa la URL del proyecto y la clave publicable (`sb_publishable_…`). Las dos
// son públicas: viajan al navegador. Lo que protege los datos es Row Level
// Security en la base (ver `supabase/migrations`), no el secreto de la clave.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

// Devuelve null si faltan las variables de entorno (por ejemplo, en tests o
// en una copia local sin `.env.local`): la hoja sigue guardando en el navegador.
export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  // Next.js reemplaza `process.env.NEXT_PUBLIC_…` por su valor al compilar,
  // pero solo si se escribe así, completo (no con `process.env[nombre]`).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}
