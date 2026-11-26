import { describe, expect, it } from "vitest";

import { isDark, parseThemeChoice, THEME_KEY, themeScript } from "@/lib/theme";

// Selector de tema (ADR 0030).

describe("parseThemeChoice", () => {
  it("keeps the known choices", () => {
    expect(parseThemeChoice("light")).toBe("light");
    expect(parseThemeChoice("dark")).toBe("dark");
    expect(parseThemeChoice("system")).toBe("system");
  });

  it("follows the system for anything else", () => {
    expect(parseThemeChoice(null)).toBe("system");
    expect(parseThemeChoice("purple")).toBe("system");
  });
});

describe("isDark", () => {
  it("uses the choice when there is one", () => {
    expect(isDark("dark", false)).toBe(true);
    expect(isDark("light", true)).toBe(false);
  });

  it("follows the system preference with 'system'", () => {
    expect(isDark("system", true)).toBe(true);
    expect(isDark("system", false)).toBe(false);
  });
});

// El script inline repite la lógica en JavaScript plano: se ejecuta con un
// documento y un localStorage falsos para comprobar que da lo mismo.
describe("themeScript", () => {
  const run = (stored: string | null, systemDark: boolean) => {
    const classes = new Set<string>();
    const html = {
      classList: {
        toggle: (name: string, on: boolean) =>
          on ? classes.add(name) : classes.delete(name),
      },
      style: { colorScheme: "" },
    };
    const localStorage = {
      getItem: (key: string) => (key === THEME_KEY ? stored : null),
    };
    const matchMedia = () => ({ matches: systemDark });
    new Function("localStorage", "matchMedia", "document", themeScript)(
      localStorage,
      matchMedia,
      { documentElement: html },
    );
    return { dark: classes.has("dark"), scheme: html.style.colorScheme };
  };

  it.each([
    ["dark", false, true],
    ["light", true, false],
    ["system", true, true],
    [null, false, false],
    ["purple", true, true],
  ] as const)("stored %s, system dark %s → dark %s", (stored, sys, dark) => {
    expect(run(stored, sys)).toEqual({
      dark,
      scheme: dark ? "dark" : "light",
    });
    expect(run(stored, sys).dark).toBe(isDark(parseThemeChoice(stored), sys));
  });
});
