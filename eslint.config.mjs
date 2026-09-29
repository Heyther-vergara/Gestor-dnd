import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Regla dura: el motor de reglas es TypeScript puro, sin framework ni BD.
  {
    files: ["src/rules-engine/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react/*",
                "react-dom",
                "react-dom/*",
                "next",
                "next/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "@supabase/*",
              ],
              message:
                "src/rules-engine debe ser TypeScript puro: no importes React, Next.js, Drizzle ni Supabase.",
            },
          ],
        },
      ],
    },
  },
  // Desactiva reglas de estilo que chocan con Prettier (va al final).
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
