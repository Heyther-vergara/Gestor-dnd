"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  type GoogleRedirect,
  GoogleLoginError,
  googleLoginErrorText,
  readGoogleRedirect,
  signOutKeepingCharacters,
  startGoogleLogin,
  uploadLocalCharacters,
  urlWithoutRedirectParams,
} from "@/lib/google-account";
import { getCharacterStore } from "@/lib/supabase/character-store";
import { getSupabaseClient } from "@/lib/supabase/client";
import { type Account, watchAccount } from "@/lib/supabase/email-auth";
import { createSupabaseGoogleAuth } from "@/lib/supabase/google-auth";

// Se prende cuando Google está configurado en Supabase (ver la guía y el
// ADR 0028). Next.js reemplaza la variable al compilar.
const GOOGLE_LOGIN_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true";

const redirectText: Record<GoogleRedirect["kind"], string | null> = {
  none: null,
  "identity-taken":
    "Esa cuenta de Google ya tiene personajes guardados. Entra a ella: los personajes de este navegador se suman a la cuenta.",
  cancelled: "Cancelaste el inicio de sesión con Google.",
  error: "No se pudo entrar con Google. Prueba de nuevo.",
};

// Vincular los personajes a una cuenta de Google (ADR 0028), para abrirlos en
// cualquier dispositivo. `onAccountChanged` hace que la lista vuelva a leer.
export function GoogleAccountPanel({
  onAccountChanged,
}: {
  onAccountChanged: () => void;
}) {
  // null = todavía no sabemos (o no hay Supabase): no se muestra nada.
  const [account, setAccount] = useState<Account | null>(null);
  const [redirect, setRedirect] = useState<GoogleRedirect>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploaded = useRef(false);

  useEffect(() => {
    if (!GOOGLE_LOGIN_ENABLED) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    // Al volver de Google con un error, la URL lo dice. Se lee ya, pero se
    // limpia recién cuando supabase-js terminó de leerla (getSession espera a
    // que termine de arrancar).
    const fromUrl = readGoogleRedirect(window.location.href);
    if (fromUrl.kind !== "none") {
      queueMicrotask(() => setRedirect(fromUrl));
      void supabase.auth.getSession().then(() => {
        window.history.replaceState(
          null,
          "",
          urlWithoutRedirectParams(window.location.href),
        );
      });
    }
    return watchAccount(supabase, setAccount);
  }, []);

  // Con una cuenta, los personajes hechos en este navegador como anónimo se
  // suben a ella (al entrar a una cuenta que ya existía, eran de otro
  // usuario). Una vez por visita.
  useEffect(() => {
    if (account?.kind !== "email" || uploaded.current) return;
    const remote = getCharacterStore();
    if (!remote) return;
    uploaded.current = true;
    void uploadLocalCharacters(window.localStorage, remote).then((ok) => {
      if (ok) onAccountChanged();
    });
  }, [account, onAccountChanged]);

  if (!GOOGLE_LOGIN_ENABLED || !account) return null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      const kind = e instanceof GoogleLoginError ? e.kind : "unknown";
      setError(googleLoginErrorText[kind]);
      setBusy(false);
    }
    // Si sale bien, el navegador se va a Google: `busy` queda prendido.
  }

  function handleGoogle(existingAccount: boolean) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void run(async () => {
      await startGoogleLogin(
        createSupabaseGoogleAuth(supabase),
        `${window.location.origin}/characters`,
        { existingAccount },
      );
    });
  }

  function handleSignOut() {
    const supabase = getSupabaseClient();
    const remote = getCharacterStore();
    if (!supabase || !remote) return;
    setBusy(true);
    setError(null);
    signOutKeepingCharacters(
      window.localStorage,
      remote,
      createSupabaseGoogleAuth(supabase),
    )
      .then((ok) => {
        if (ok) {
          uploaded.current = false;
          onAccountChanged();
        } else {
          setError(
            "No se pudo guardar en la nube antes de salir. Revisa la conexión y prueba de nuevo.",
          );
        }
      })
      .catch(() => setError(googleLoginErrorText.unknown))
      .finally(() => setBusy(false));
  }

  const errorText = error && (
    <p className="text-sm text-destructive" role="alert">
      {error}
    </p>
  );

  if (account.kind === "email") {
    return (
      <section
        aria-label="Cuenta"
        className="grid gap-1 rounded-lg border border-border bg-card p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <p className="text-sm text-muted-foreground">
            Tus personajes están en tu cuenta:{" "}
            <span className="text-foreground">{account.email}</span>
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={handleSignOut}
            disabled={busy}
          >
            Salir
          </Button>
        </div>
        {errorText}
      </section>
    );
  }

  const taken = redirect.kind === "identity-taken";
  const notice = redirectText[redirect.kind];

  return (
    <section
      aria-label="Cuenta"
      className="grid gap-2 rounded-lg border border-border bg-card p-3"
    >
      <p className="text-sm text-muted-foreground">
        Guarda tus personajes en tu cuenta de Google para abrirlos en cualquier
        dispositivo.
      </p>
      {notice && (
        <p
          className={
            taken ? "text-sm text-primary" : "text-sm text-destructive"
          }
          role="status"
        >
          {notice}
        </p>
      )}
      <Button
        className="justify-self-start"
        onClick={() => handleGoogle(taken)}
        disabled={busy}
      >
        {busy
          ? "Abriendo Google…"
          : taken
            ? "Entrar a esa cuenta"
            : "Continuar con Google"}
      </Button>
      {errorText}
    </section>
  );
}
