// La nube real para `character-sync`: la tabla `characters` de Supabase.
//
// Cada navegador entra con un usuario anónimo (ADR 0013): no hay pantalla de
// login, pero Supabase igual le da un id de usuario, y RLS hace que solo pueda
// leer y escribir sus propias filas. Más adelante ese usuario se puede
// convertir en una cuenta con email sin perder la hoja.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { RemoteCharacterStore } from "../character-sync";
import { getSupabaseClient } from "./client";

const TABLE = "characters";

// El usuario de la sesión guardada en el navegador, o null si no hay.
async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

// Se asegura de que haya sesión. La primera vez crea el usuario anónimo; las
// siguientes, supabase-js recupera la sesión que dejó guardada en el navegador.
//
// Solo `save` la llama (ADR 0023): leer, listar o borrar sin sesión no tiene
// nada que hacer en la nube, porque un usuario nuevo no tiene filas. Antes,
// cada visita a "Mis personajes" creaba un usuario anónimo aunque la persona
// no guardara nada, y los bots llenaban la tabla de usuarios.
async function ensureUserId(supabase: SupabaseClient): Promise<string> {
  const existing = await currentUserId(supabase);
  if (existing) return existing;

  const { data: signIn, error } = await supabase.auth.signInAnonymously();
  if (error || !signIn.user) throw error ?? new Error("Sin usuario anónimo");
  return signIn.user.id;
}

export function createSupabaseCharacterStore(
  supabase: SupabaseClient,
): RemoteCharacterStore {
  return {
    async load(characterId) {
      if (!(await currentUserId(supabase))) return null;
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

    async list() {
      if (!(await currentUserId(supabase))) return [];
      // RLS devuelve solo las filas del usuario. Cada `data` se valida con Zod
      // en `character-sync`.
      const { data, error } = await supabase.from(TABLE).select("data");
      if (error) throw error;
      return ((data ?? []) as { data: unknown }[]).map((row) => row.data);
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
      // Sin sesión no hay filas propias que borrar.
      if (!(await currentUserId(supabase))) return;
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .eq("character_id", characterId);
      if (error) throw error;
    },
  };
}

// Una sola nube para toda la app (la lista, el creador y la hoja). null si
// Supabase no está configurado: entonces todo se guarda en el navegador.
let sharedStore: RemoteCharacterStore | null | undefined;

export function getCharacterStore(): RemoteCharacterStore | null {
  if (sharedStore === undefined) {
    const supabase = getSupabaseClient();
    sharedStore = supabase ? createSupabaseCharacterStore(supabase) : null;
  }
  return sharedStore;
}
