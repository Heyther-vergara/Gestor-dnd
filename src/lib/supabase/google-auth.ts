// El login real para `google-account`: Supabase Auth con Google (ADR 0028).

import { isAuthApiError, type SupabaseClient } from "@supabase/supabase-js";

import { type GoogleAuth, GoogleLoginError } from "../google-account";

// Errores de Supabase cuando falta configurar algo en el panel: Google sin
// activar o "Allow manual linking" apagado.
const NOT_CONFIGURED = new Set([
  "provider_disabled",
  "manual_linking_disabled",
  "validation_failed",
]);

function toLoginError(error: unknown): GoogleLoginError {
  if (isAuthApiError(error) && NOT_CONFIGURED.has(error.code ?? "")) {
    return new GoogleLoginError("not-configured");
  }
  return new GoogleLoginError("unknown");
}

export function createSupabaseGoogleAuth(supabase: SupabaseClient): GoogleAuth {
  return {
    async session() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return "none";
      return user.is_anonymous ? "anonymous" : "permanent";
    },

    async linkGoogle(redirectTo) {
      // Lleva a Google. Al volver, supabase-js lee la sesión de la URL.
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw toLoginError(error);
    },

    async signInWithGoogle(redirectTo) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw toLoginError(error);
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw toLoginError(error);
    },
  };
}
