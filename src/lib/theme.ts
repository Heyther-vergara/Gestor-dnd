// Tema claro, oscuro o el del sistema (ADR 0030). Es TypeScript puro para
// poder testearlo; lo usan el script inline del layout y ThemeToggle.

export const THEME_KEY = "gestor-dnd:theme";

export const themeChoices = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof themeChoices)[number];

// Lo guardado en localStorage puede ser cualquier cosa (otra versión, un
// usuario que lo editó): si no es una opción conocida, se sigue al sistema.
export function parseThemeChoice(value: string | null): ThemeChoice {
  return themeChoices.find((choice) => choice === value) ?? "system";
}

// ¿Va la clase .dark? Con "system", decide la preferencia del sistema.
export function isDark(choice: ThemeChoice, systemPrefersDark: boolean) {
  return choice === "dark" || (choice === "system" && systemPrefersDark);
}

// Corre en <head> antes de pintar la página, para que no se vea un destello
// del tema claro al cargar en modo oscuro (guía de Next.js "Preventing
// flash before hydration"). Repite la lógica de arriba en JavaScript plano
// porque es un texto, no un módulo; el test comprueba que coincidan.
export const themeScript = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(c!=="light"&&c!=="dark")c="system";var d=c==="dark"||(c==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
