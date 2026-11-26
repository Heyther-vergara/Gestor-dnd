// Vincular los personajes a una cuenta de Google (ADR 0028).
//
// Con el usuario anónimo (ADR 0013) los personajes quedan atados a un
// navegador. Al vincular Google, Supabase le agrega esa identidad al MISMO
// usuario (mismo id): las filas de `characters` ya son suyas y no hay que
// copiar nada. Después, en otro dispositivo, se entra con Google y aparecen.
//
// Como `character-sync`, no importa Supabase: recibe el login como interfaz
// (`GoogleAuth`) y se testea con uno falso. La implementación real está en
// `lib/supabase/google-auth.ts`.

import {
  clearCharacter,
  type EnumerableStorage,
  listLocalCharacters,
  savedCharacterSchema,
} from "./character-storage";
import type { RemoteCharacterStore } from "./character-sync";

export type GoogleAuth = {
  // Qué sesión hay en este navegador.
  session(): Promise<"none" | "anonymous" | "permanent">;
  // Agrega Google al usuario anónimo. Lleva a Google y vuelve a `redirectTo`.
  linkGoogle(redirectTo: string): Promise<void>;
  // Entra a la cuenta de Google (nueva o ya existente).
  signInWithGoogle(redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
};

export type GoogleLoginErrorKind = "not-configured" | "unknown";

export class GoogleLoginError extends Error {
  constructor(readonly kind: GoogleLoginErrorKind) {
    super(kind);
    this.name = "GoogleLoginError";
  }
}

export const googleLoginErrorText: Record<GoogleLoginErrorKind, string> = {
  "not-configured":
    "El inicio de sesión con Google todavía no está activado en el servidor.",
  unknown: "Algo falló. Revisa la conexión y prueba de nuevo.",
};

// Empieza el login. Las dos llamadas sacan al usuario de la app (van a Google
// y vuelven a `redirectTo`), así que esto es lo último que corre.
// - Si hay usuario anónimo, se le vincula Google: sus personajes pasan a la
//   cuenta.
// - Si no hay sesión, se entra directo: no hace falta crear un anónimo.
// - `existingAccount`: esa cuenta de Google ya era de otro usuario (por
//   ejemplo, la vinculaste en otro dispositivo). Se entra a ella; los
//   personajes de este navegador se suben después (`uploadLocalCharacters`).
export async function startGoogleLogin(
  auth: GoogleAuth,
  redirectTo: string,
  options: { existingAccount?: boolean } = {},
): Promise<"link" | "sign-in"> {
  if (!options.existingAccount && (await auth.session()) === "anonymous") {
    await auth.linkGoogle(redirectTo);
    return "link";
  }
  await auth.signInWithGoogle(redirectTo);
  return "sign-in";
}

// Lo que dice la URL al volver de Google. Supabase pone los errores en la
// query o en el hash (`#error=…`), según el caso.
export type GoogleRedirect =
  | { kind: "none" }
  // Esa cuenta de Google ya está vinculada a otro usuario.
  | { kind: "identity-taken" }
  // La persona canceló en la pantalla de Google.
  | { kind: "cancelled" }
  | { kind: "error" };

const REDIRECT_PARAMS = ["error", "error_code", "error_description"];

function redirectParams(href: string): URLSearchParams {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.slice(1));
  // Como supabase-js: la query gana sobre el hash.
  url.searchParams.forEach((value, key) => params.set(key, value));
  return params;
}

export function readGoogleRedirect(href: string): GoogleRedirect {
  const params = redirectParams(href);
  if (!REDIRECT_PARAMS.some((key) => params.has(key))) return { kind: "none" };
  if (params.get("error_code") === "identity_already_exists") {
    return { kind: "identity-taken" };
  }
  if (params.get("error") === "access_denied") return { kind: "cancelled" };
  return { kind: "error" };
}

// La misma URL sin los parámetros del error, para que recargar la página no
// vuelva a mostrar el aviso.
export function urlWithoutRedirectParams(href: string): string {
  const url = new URL(href);
  for (const key of REDIRECT_PARAMS) url.searchParams.delete(key);
  const hash = new URLSearchParams(url.hash.slice(1));
  if (REDIRECT_PARAMS.some((key) => hash.has(key))) url.hash = "";
  return url.toString();
}

// Sube a la cuenta los personajes de este navegador que la nube no tiene o
// tiene más viejos. Se usa al entrar a una cuenta que ya existía: así los
// personajes que hiciste aquí como anónimo no se quedan atrás.
// Devuelve false si la nube falló.
export async function uploadLocalCharacters(
  local: EnumerableStorage,
  remote: RemoteCharacterStore,
): Promise<boolean> {
  try {
    const inCloud = new Map<string, string>();
    for (const raw of await remote.list()) {
      const parsed = savedCharacterSchema.safeParse(raw);
      if (parsed.success) {
        inCloud.set(parsed.data.character.id, parsed.data.savedAt);
      }
    }
    for (const saved of listLocalCharacters(local)) {
      const cloudDate = inCloud.get(saved.character.id);
      if (!cloudDate || Date.parse(saved.savedAt) > Date.parse(cloudDate)) {
        await remote.save(saved);
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Salir de la cuenta. Como en el ADR 0014, se borran las copias de este
// navegador (puede ser una computadora compartida), pero antes se suben a la
// cuenta para no perder nada. Si la subida falla, no se sale.
// El homebrew no se borra: todavía no está en la nube (ADR 0019).
export async function signOutKeepingCharacters(
  local: EnumerableStorage,
  remote: RemoteCharacterStore,
  auth: GoogleAuth,
): Promise<boolean> {
  if (!(await uploadLocalCharacters(local, remote))) return false;
  await auth.signOut();
  for (const saved of listLocalCharacters(local)) {
    clearCharacter(local, saved.character.id);
  }
  return true;
}
