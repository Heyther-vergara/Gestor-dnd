"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  isDark,
  parseThemeChoice,
  THEME_KEY,
  type ThemeChoice,
  themeChoices,
} from "@/lib/theme";

const labels: Record<ThemeChoice, string> = {
  light: "Claro",
  dark: "Oscuro",
  system: "Sistema",
};

const DARK_QUERY = "(prefers-color-scheme: dark)";
// Aviso interno para que el selector se entere de un cambio hecho aquí
// mismo (el evento "storage" solo llega a las otras pestañas).
const CHANGE_EVENT = "gestor-dnd:theme-change";

function readChoice(): ThemeChoice {
  try {
    return parseThemeChoice(window.localStorage.getItem(THEME_KEY));
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function applyTheme(choice: ThemeChoice) {
  const dark = isDark(choice, window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

// Claro, oscuro o el del sistema (ADR 0030). El tema ya lo aplicó el script
// del layout antes de pintar; este componente solo lo cambia y lo guarda.
export function ThemeToggle() {
  // En el servidor no hay localStorage: se asume "system" y React corrige
  // la marca al hidratar, sin error.
  const choice = useSyncExternalStore(
    subscribe,
    readChoice,
    (): ThemeChoice => "system",
  );

  // Con "Sistema", si el usuario cambia el modo de su teléfono o
  // computadora con la página abierta, la app lo sigue.
  // No se aplica el tema al montar: al hidratar, `choice` vale "system" un
  // instante y pisaría el tema que puso el script del layout.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const onSystemChange = () => applyTheme("system");
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, [choice]);

  const choose = (next: ThemeChoice) => {
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Sin almacenamiento, el tema cambia igual pero no se recuerda.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <fieldset className="inline-flex items-center gap-2">
      <legend className="sr-only">Tema</legend>
      <span aria-hidden="true">Tema</span>
      <span className="inline-flex rounded-sm border border-border bg-card p-0.5">
        {themeChoices.map((option) => (
          <label
            key={option}
            className="cursor-pointer rounded-sm px-2 py-0.5 has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:outline-2 has-focus-visible:outline-ring"
          >
            <input
              type="radio"
              name="theme"
              value={option}
              checked={choice === option}
              onChange={() => choose(option)}
              className="sr-only"
            />
            {labels[option]}
          </label>
        ))}
      </span>
    </fieldset>
  );
}
