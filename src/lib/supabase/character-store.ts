// La nube real para `character-sync`: la tabla `characters` de Supabase.
//
// Cada navegador entra con un usuario anónimo (ADR 0013): no hay pantalla de
// login, pero Supabase igual le da un id de usuario, y RLS hace que solo pueda
// leer y escribir sus propias filas. Más adelante ese usuario se puede
// convertir en una cuenta con email sin perder la hoja.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { RemoteCharacterStore } from "../character-sync";

const TABLE = "characters";

// Se asegura de que haya sesión. La primera vez crea el usuario anónimo; las
// siguientes, supabase-js recupera la sesión que dejó guardada en el navegador.
async function ensureUserId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session.user.id;

  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) throw error ?? new Error("Sin usuario anónimo");
  return signIn.user.id;
}

export function createSupabaseCharacterStore(
  supabase: SupabaseClient,
): RemoteCharacterStore {
  return {
    async load(characterId) {
      await ensureUserId(supabase);
      // No hace falta filtrar por usuario: RLS ya devuelve solo sus filas.
      const { data, error } = await supabase
        .from(TABLE)
        .select("data")
        .eq("character_id", characterId)
        .maybeSingle();
      if (error) throw error;
      // `data` es JSONB sin tipo: se valida con Zod en `character-sync`.
      return (data as { data: unknown } | null)?.data ?? null;
    },

    async save(saved) {
      const userId = await ensureUserId(supabase);
      // upsert = insertar o, si ya existe la fila (mismo usuario y personaje),
      // reemplazarla.
      const { error } = await supabase.from(TABLE).upsert({
        user_id: userId,
        character_id: saved.character.id,
        data: saved,
        updated_at: saved.savedAt,
      });
      if (error) throw error;
    },

    async remove(characterId) {
      await ensureUserId(supabase);
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq("character_id", characterId);
      if (error) throw error;
    },
  };
}
