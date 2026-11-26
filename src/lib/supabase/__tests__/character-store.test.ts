// ADR 0023 (SOC 2 CC6.6 · ISO 27001 A.8.6): solo guardar crea un usuario
// anónimo. Leer, listar o borrar sin sesión no toca la nube.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { createSupabaseCharacterStore } from "../character-store";

// Una nube falsa sin sesión: cuenta los logins anónimos y las consultas.
function fakeSupabaseWithoutSession() {
  const signInAnonymously = vi.fn(async () => ({
    data: { user: { id: "new-user" } },
    error: null,
  }));
  const upsert = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({ upsert }));
  const client = {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      signInAnonymously,
    },
    from,
  } as unknown as SupabaseClient;
  return { client, signInAnonymously, from, upsert };
}

describe("createSupabaseCharacterStore without a session", () => {
  it("list returns nothing and does not create an anonymous user", async () => {
    const { client, signInAnonymously, from } = fakeSupabaseWithoutSession();
    const store = createSupabaseCharacterStore(client);
    expect(await store.list()).toEqual([]);
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("load returns null and does not create an anonymous user", async () => {
    const { client, signInAnonymously, from } = fakeSupabaseWithoutSession();
    const store = createSupabaseCharacterStore(client);
    expect(await store.load("any-id")).toBeNull();
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("remove does nothing and does not create an anonymous user", async () => {
    const { client, signInAnonymously, from } = fakeSupabaseWithoutSession();
    const store = createSupabaseCharacterStore(client);
    await store.remove("any-id");
    expect(signInAnonymously).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("save creates the anonymous user and stores the row under it", async () => {
    const { client, signInAnonymously, upsert } = fakeSupabaseWithoutSession();
    const store = createSupabaseCharacterStore(client);
    const saved = {
      character: { id: "char-1" },
      savedAt: "2026-11-25T00:00:00.000Z",
    } as unknown as Parameters<typeof store.save>[0];
    await store.save(saved);
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "new-user", character_id: "char-1" }),
    );
  });
});
