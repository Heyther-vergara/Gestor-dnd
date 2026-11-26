import { describe, expect, it } from "vitest";

import {
  type EnumerableStorage,
  listLocalCharacters,
  saveCharacter,
  toSavedCharacter,
} from "@/lib/character-storage";
import type { RemoteCharacterStore } from "@/lib/character-sync";
import {
  type GoogleAuth,
  readGoogleRedirect,
  signOutKeepingCharacters,
  startGoogleLogin,
  uploadLocalCharacters,
  urlWithoutRedirectParams,
} from "@/lib/google-account";
import { sampleCharacter } from "@/lib/sample-character";
import type { Character } from "@/rules-engine/schemas";

function memoryStorage(): EnumerableStorage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function memoryCloud(options: { fail?: boolean } = {}) {
  const rows = new Map<string, unknown>();
  const store: RemoteCharacterStore = {
    load: async (id) => rows.get(id) ?? null,
    async list() {
      if (options.fail) throw new Error("offline");
      return [...rows.values()];
    },
    async save(saved) {
      if (options.fail) throw new Error("offline");
      rows.set(saved.character.id, saved);
    },
    remove: async (id) => void rows.delete(id),
  };
  return { store, rows };
}

function fakeAuth(session: "none" | "anonymous" | "permanent") {
  const calls: string[] = [];
  const auth: GoogleAuth = {
    async session() {
      return session;
    },
    async linkGoogle(redirectTo) {
      calls.push(`link:${redirectTo}`);
    },
    async signInWithGoogle(redirectTo) {
      calls.push(`sign-in:${redirectTo}`);
    },
    async signOut() {
      calls.push("sign-out");
    },
  };
  return { auth, calls };
}

function named(id: string, name: string): Character {
  return { ...sampleCharacter, id, name };
}

const earlier = new Date("2026-11-01T10:00:00.000Z");
const later = new Date("2026-11-02T10:00:00.000Z");
const back = "https://gestor.example/characters";

describe("startGoogleLogin", () => {
  // El caso principal: el usuario anónimo gana la identidad de Google y sigue
  // siendo el mismo (mismo id), así que sus personajes pasan a la cuenta.
  it("links Google to the anonymous user", async () => {
    const { auth, calls } = fakeAuth("anonymous");
    expect(await startGoogleLogin(auth, back)).toBe("link");
    expect(calls).toEqual([`link:${back}`]);
  });

  // Sin sesión no hay nada que vincular: se entra directo y no se crea un
  // usuario anónimo de más (ADR 0023).
  it("signs in directly when there is no session", async () => {
    const { auth, calls } = fakeAuth("none");
    expect(await startGoogleLogin(auth, back)).toBe("sign-in");
    expect(calls).toEqual([`sign-in:${back}`]);
  });

  // "Entrar a mi cuenta" después de que Google ya estaba vinculado a otra.
  it("signs in when asked to use the existing account", async () => {
    const { auth, calls } = fakeAuth("anonymous");
    expect(await startGoogleLogin(auth, back, { existingAccount: true })).toBe(
      "sign-in",
    );
    expect(calls).toEqual([`sign-in:${back}`]);
  });
});

describe("readGoogleRedirect", () => {
  it("is empty for a normal URL", () => {
    expect(readGoogleRedirect(back)).toEqual({ kind: "none" });
  });

  it("detects a Google account that already belongs to another user", () => {
    expect(
      readGoogleRedirect(
        `${back}?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked`,
      ),
    ).toEqual({ kind: "identity-taken" });
  });

  it("reads errors from the hash too", () => {
    expect(
      readGoogleRedirect(
        `${back}#error=access_denied&error_description=cancelled`,
      ),
    ).toEqual({ kind: "cancelled" });
  });

  it("reports other errors", () => {
    expect(readGoogleRedirect(`${back}?error=server_error`)).toEqual({
      kind: "error",
    });
  });

  it("removes the redirect params and keeps the rest", () => {
    expect(
      urlWithoutRedirectParams(
        `${back}?tab=1&error=access_denied&error_code=x&error_description=y#error=z`,
      ),
    ).toBe(`${back}?tab=1`);
  });
});

describe("uploadLocalCharacters", () => {
  it("uploads browser characters that are missing or newer in the cloud", async () => {
    const local = memoryStorage();
    const cloud = memoryCloud();
    saveCharacter(local, named("ana", "Ana"), later);
    saveCharacter(local, named("bo", "Bo"), earlier);
    const newerInCloud = toSavedCharacter(named("bo", "Bo nuevo"), later);
    cloud.rows.set("bo", newerInCloud);

    expect(await uploadLocalCharacters(local, cloud.store)).toBe(true);
    expect(cloud.rows.get("ana")).toEqual(
      toSavedCharacter(named("ana", "Ana"), later),
    );
    expect(cloud.rows.get("bo")).toEqual(newerInCloud);
  });

  it("reports when the cloud is offline", async () => {
    const local = memoryStorage();
    saveCharacter(local, named("ana", "Ana"), later);
    expect(
      await uploadLocalCharacters(local, memoryCloud({ fail: true }).store),
    ).toBe(false);
  });
});

describe("signOutKeepingCharacters", () => {
  // Al salir se borran las copias de este navegador (puede ser compartido,
  // ADR 0014), pero antes se suben: así no se pierde nada.
  it("uploads, signs out and forgets the browser copies", async () => {
    const local = memoryStorage();
    const cloud = memoryCloud();
    const { auth, calls } = fakeAuth("permanent");
    saveCharacter(local, named("ana", "Ana"), later);

    expect(await signOutKeepingCharacters(local, cloud.store, auth)).toBe(true);
    expect(calls).toEqual(["sign-out"]);
    expect(cloud.rows.has("ana")).toBe(true);
    expect(listLocalCharacters(local)).toEqual([]);
  });

  it("does not sign out when the upload fails", async () => {
    const local = memoryStorage();
    const { auth, calls } = fakeAuth("permanent");
    saveCharacter(local, named("ana", "Ana"), later);

    expect(
      await signOutKeepingCharacters(
        local,
        memoryCloud({ fail: true }).store,
        auth,
      ),
    ).toBe(false);
    expect(calls).toEqual([]);
    expect(listLocalCharacters(local)).toHaveLength(1);
  });
});
