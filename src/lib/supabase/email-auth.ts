// El login real para `email-login`: Supabase Auth con código por email
// (ADR 0014). Acá se traducen los errores de Supabase a los de la app.

import {
  isAuthApiError,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import {
  type EmailAuth,
  EmailLoginError,
  type EmailLoginErrorKind,
} from "../email-login";

// Quién está usando la hoja ahora:
// - "anonymous": el usuario sin login que se crea solo (ADR 0013).
// - "email": una cuenta con email confirmado.
// - "none": todavía no hay sesión (se crea la anónima al guardar).
export type Account =
  | { kind: "none" }
  | { kind: "anonymous"; userId: string }
  | { kind: "email"; userId: string; email: string };

function toAccount(user: User | null | undefined): Account {
  if (!user) return { kind: "none" };
  // Mientras el email no se confirma, el usuario sigue siendo anónimo.
  if (user.is_anonymous || !user.email) {
    return { kind: "anonymous", userId: user.id };
  }
  return { kind: "email", userId: user.id, email: user.email };
}

// Avisa cada vez que cambia la sesión (también al empezar, con la que
// supabase-js tenía guardada). Devuelve la función para dejar de escuchar.
export function watchAccount(
  supabase: SupabaseClient,
  onChange: (account: Account) => void,
): () => void {
  // Ojo: dentro de este callback no se puede esperar (`await`) otra llamada
  // de supabase.auth, porque se traba. Solo leemos el usuario de la sesión.
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(toAccount(session?.user));
  });
  return () => data.subscription.unsubscribe();
}

export async function signOut(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toLoginError(error);
}

function toLoginError(error: unknown): EmailLoginError {
  if (!isAuthApiError(error)) return new EmailLoginError("unknown");
  const kinds: Record<string, EmailLoginErrorKind> = {
    email_address_invalid: "invalid-email",
    validation_failed: "invalid-email",
    otp_expired: "invalid-code",
    over_email_send_rate_limit: "rate-limit",
    over_request_rate_limit: "rate-limit",
  };
  return new EmailLoginError(kinds[error.code ?? ""] ?? "unknown");
}

export function createSupabaseEmailAuth(supabase: SupabaseClient): EmailAuth {
  return {
    async isAnonymous() {
      const { data } = await supabase.auth.getSession();
      return data.session?.user.is_anonymous === true;
    },

    async linkEmail(email) {
      // Agregar un email a un usuario anónimo es, para Supabase, un "cambio
      // de email": manda el email "Change Email Address" con el código.
      const { error } = await supabase.auth.updateUser({ email });
      if (!error) return "code-sent";
      if (
        isAuthApiError(error) &&
        (error.code === "email_exists" || error.code === "user_already_exists")
      ) {
        return "email-taken";
      }
      throw toLoginError(error);
    },

    async sendSignInCode(email) {
      // Manda el email "Magic Link" (o "Confirm signup" si es una cuenta
      // nueva). Con `{{ .Token }}` en la plantilla, trae el código.
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw toLoginError(error);
    },

    async verifyCode(email, token, mode) {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: mode === "link" ? "email_change" : "email",
      });
      if (error) throw toLoginError(error);
    },
  };
}
