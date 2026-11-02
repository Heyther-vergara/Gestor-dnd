// Login con email y código (ADR 0014).
//
// Como `character-sync`, este archivo no importa Supabase: recibe el login
// como una interfaz chica (`EmailAuth`) y así se testea con un login falso.
// La implementación real vive en `lib/supabase/email-auth.ts`.

import { z } from "zod";

// Hay dos caminos, y el usuario no tiene que elegir:
// - "link": este navegador ya tiene un usuario anónimo. Se le agrega el email
//   y sigue siendo el mismo usuario (mismo id), así que la hoja que ya estaba
//   guardada pasa a la cuenta sin copiar nada.
// - "sign-in": el email ya es de una cuenta (por ejemplo, la creaste en otro
//   dispositivo). Se entra a esa cuenta y se usa la hoja guardada ahí.
export type LoginMode = "link" | "sign-in";

export type EmailAuth = {
  // ¿La sesión actual es de un usuario anónimo?
  isAnonymous(): Promise<boolean>;
  // Pide agregar el email al usuario anónimo. Supabase manda un código.
  linkEmail(email: string): Promise<"code-sent" | "email-taken">;
  // Pide un código para entrar a la cuenta de ese email.
  sendSignInCode(email: string): Promise<void>;
  // Confirma el código. Si está bien, queda la sesión de la cuenta.
  verifyCode(email: string, code: string, mode: LoginMode): Promise<void>;
};

// Errores que la pantalla sabe explicar.
export type EmailLoginErrorKind =
  "invalid-email" | "invalid-code" | "rate-limit" | "unknown";

export class EmailLoginError extends Error {
  constructor(readonly kind: EmailLoginErrorKind) {
    super(kind);
    this.name = "EmailLoginError";
  }
}

export const emailLoginErrorText: Record<EmailLoginErrorKind, string> = {
  "invalid-email": "Ese email no parece válido.",
  "invalid-code": "El código no es correcto o ya venció. Pedí uno nuevo.",
  "rate-limit":
    "Se mandaron demasiados emails seguidos. Esperá unos minutos y probá de nuevo.",
  unknown: "Algo falló. Revisá la conexión y probá de nuevo.",
};

// Paso 1: manda el código por email y dice qué camino se tomó, para usarlo
// al confirmar el código.
export async function requestLoginCode(
  auth: EmailAuth,
  email: string,
): Promise<LoginMode> {
  if (await auth.isAnonymous()) {
    const linked = await auth.linkEmail(email);
    if (linked === "code-sent") return "link";
  }
  await auth.sendSignInCode(email);
  return "sign-in";
}

const emailSchema = z.email();

// El email como lo guarda Supabase (sin espacios y en minúsculas), o null si
// no es un email.
export function parseEmail(input: string): string | null {
  const email = input.trim().toLowerCase();
  return emailSchema.safeParse(email).success ? email : null;
}

// El código que llega por email: solo dígitos (Supabase usa 6 por defecto,
// pero el largo se puede cambiar en el panel). Se ignoran los espacios por si
// se pegó con alguno.
export function parseLoginCode(input: string): string | null {
  const code = input.replace(/\s/g, "");
  return /^\d{6,10}$/.test(code) ? code : null;
}
