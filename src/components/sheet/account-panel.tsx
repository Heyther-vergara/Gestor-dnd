"use client";

import { type FormEvent, useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  EmailLoginError,
  emailLoginErrorText,
  type LoginMode,
  parseEmail,
  parseLoginCode,
  requestLoginCode,
} from "@/lib/email-login";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  type Account,
  createSupabaseEmailAuth,
  signOut,
  watchAccount,
} from "@/lib/supabase/email-auth";

// Qué se muestra en el formulario.
type Step =
  | { kind: "closed" }
  | { kind: "email" }
  | { kind: "code"; email: string; mode: LoginMode };

// Login con email apagado por ahora: Julian eligió dejar solo el usuario
// anónimo para no depender del SMTP ni de las plantillas de email (ADR 0014,
// nota del 2026-11-12). El código queda listo para volver a prenderlo.
const EMAIL_LOGIN_ENABLED = false;

// Mismo estilo que los inputs de shadcn.
const inputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

// Login con email para abrir la misma hoja en otros dispositivos (ADR 0014).
// Avisa a la hoja cuando cambia de usuario, para que vuelva a leer lo
// guardado: "signed-in" al entrar a una cuenta que ya existía, "signed-out"
// al salir. Al agregar el email a la sesión anónima no hace falta: el usuario
// es el mismo y la hoja ya está guardada a su nombre.
export function AccountPanel({
  onUserSwitched,
}: {
  onUserSwitched: (change: "signed-in" | "signed-out") => void;
}) {
  // null = todavía no sabemos (o no hay Supabase): no se muestra nada.
  const [account, setAccount] = useState<Account | null>(null);
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailId = useId();
  const codeId = useId();
  const errorId = useId();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    return watchAccount(supabase, setAccount);
  }, []);

  if (!EMAIL_LOGIN_ENABLED || !account) return null;

  // Corre una acción de Supabase mostrando "ocupado" y el error si falla.
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      const kind = e instanceof EmailLoginError ? e.kind : "unknown";
      setError(emailLoginErrorText[kind]);
    } finally {
      setBusy(false);
    }
  }

  function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = new FormData(event.currentTarget).get("email");
    const email = parseEmail(typeof raw === "string" ? raw : "");
    if (!email) {
      setError(emailLoginErrorText["invalid-email"]);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void run(async () => {
      const mode = await requestLoginCode(
        createSupabaseEmailAuth(supabase),
        email,
      );
      setStep({ kind: "code", email, mode });
    });
  }

  function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.kind !== "code") return;
    const raw = new FormData(event.currentTarget).get("code");
    const code = parseLoginCode(typeof raw === "string" ? raw : "");
    if (!code) {
      setError(emailLoginErrorText["invalid-code"]);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void run(async () => {
      await createSupabaseEmailAuth(supabase).verifyCode(
        step.email,
        code,
        step.mode,
      );
      setStep({ kind: "closed" });
      if (step.mode === "sign-in") onUserSwitched("signed-in");
    });
  }

  function handleSignOut() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    void run(async () => {
      await signOut(supabase);
      onUserSwitched("signed-out");
    });
  }

  const errorText = error && (
    <p id={errorId} className="text-sm text-destructive" role="alert">
      {error}
    </p>
  );

  if (account.kind === "email") {
    return (
      <div className="grid gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <p className="text-sm text-muted-foreground">
            Cuenta: <span className="text-foreground">{account.email}</span>
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
      </div>
    );
  }

  if (step.kind === "closed") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4">
        <p className="text-sm text-muted-foreground">
          Para abrir esta hoja en otro dispositivo, entrá con tu email.
        </p>
        <Button
          variant="link"
          size="sm"
          onClick={() => setStep({ kind: "email" })}
        >
          Entrar con email
        </Button>
      </div>
    );
  }

  if (step.kind === "email") {
    return (
      <form className="grid gap-2" onSubmit={handleEmail} noValidate>
        <label htmlFor={emailId} className="text-sm">
          Tu email. Te mandamos un código para entrar.
        </label>
        <div className="flex gap-2">
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Enviando…" : "Enviar código"}
          </Button>
        </div>
        {errorText}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="justify-self-start px-0"
          onClick={() => {
            setStep({ kind: "closed" });
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </form>
    );
  }

  return (
    <form className="grid gap-2" onSubmit={handleCode} noValidate>
      <label htmlFor={codeId} className="text-sm">
        Escribí el código que te llegó a{" "}
        <span className="font-medium">{step.email}</span>.
      </label>
      <p className="text-sm text-muted-foreground">
        {step.mode === "link"
          ? "Esta hoja queda guardada en tu cuenta."
          : "Ya tenés una cuenta con ese email: vas a ver la hoja guardada en ella."}
      </p>
      <div className="flex gap-2">
        <input
          id={codeId}
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          className={inputClass}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Confirmando…" : "Confirmar"}
        </Button>
      </div>
      {errorText}
      <Button
        type="button"
        variant="link"
        size="sm"
        className="justify-self-start px-0"
        onClick={() => {
          setStep({ kind: "email" });
          setError(null);
        }}
      >
        Usar otro email
      </Button>
    </form>
  );
}
