@AGENTS.md

# Gestor de personajes 5e — contexto para Claude Code

App web responsive de hojas de personaje compatibles con 5e (SRD 5.1 / 2014 y SRD 5.2.1 / 2024) con homebrew por paquetes. Plan completo, fases y pendientes: `docs/plan.md`. Decisiones: `docs/decisions/`.

## Cómo trabajar

- Usuario principiante, proyecto de portafolio. Explica decisiones importantes en pocas palabras (qué y por qué).
- Pasos pequeños: propone plan corto → espera aprobación → implementa.
- No agregues dependencias sin preguntar y explicar para qué sirven.
- Si algo es ambiguo o parece mala idea, dilo en vez de adivinar.
- Código, archivos e identificadores en **inglés**; comentarios de dominio y explicaciones en **español**.
- Consulta docs actuales (Context7) antes de usar APIs de Next.js, Drizzle, Supabase, shadcn.
- No avances a la siguiente fase sin que la anterior esté desplegada y con tests en verde.

## Stack

TypeScript strict · Next.js 16 (App Router) + React 19 · pnpm · Tailwind 4 + shadcn/ui (radix-nova) · React Hook Form + Zod · Zustand (hoja en edición) + TanStack Query (datos servidor) · Supabase (Postgres + Auth) · Drizzle ORM + drizzle-kit · Vitest · Playwright (desde fase 3) · GitHub Actions · Vercel.
Cada librería se instala en la fase que la usa.

## Arquitectura

- `src/rules-engine/`: **TypeScript puro y determinista.** Prohibido importar React, Next.js, Drizzle o Supabase (lo aplica `no-restricted-imports` en `eslint.config.mjs`).
  - `schemas/` esquemas Zod · `engine/` `calculateSheet()` · `__tests__/`
- `src/content/srd-2024/` (y `srd-2014/` en v1): paquetes de contenido en JSON.
- `src/db/` esquema Drizzle y queries · `src/components/ui/` shadcn · `src/lib/` utilidades · `tests/e2e/` Playwright.

### Modelo

- Todo el contenido es un **Package** (`source: "srd" | "homebrew"`, `edition: "2014" | "2024"`). SRD y homebrew usan el mismo esquema.
- **Content**: `type` (class, subclass, species, background, feat, item, spell…), `data` + `effects[]` en JSONB, un esquema Zod por `type`.
- **Effect**: `{ target, op, value, condition? }`, p. ej. `{ target: "ac", op: "add", value: 1 }`.
- **Character** guarda solo elecciones y estado (`activePackageIds`, `baseAbilityScores`, `choices`, `inventory`, `playState`). **Nunca valores derivados.**
- `calculateSheet(character, contentIndex) => ComputedSheet`, pura. Orden: base → set → add → multiply → min/max.
- Lo no modelable: notas de texto y ajustes manuales en la hoja.

## Reglas legales

- Solo contenido de SRD 5.1 y SRD 5.2.1 (CC-BY-4.0), con atribución a Wizards of the Coast en la página de créditos.
- Sin marca "Dungeons & Dragons", logos ni arte oficial. Se describe como "compatible con 5e".
- Nunca agregar contenido de libros oficiales fuera del SRD.

## Flujo por tarea

1. Plan corto → aprobación.
2. Tests primero en `rules-engine` y validación de esquemas (personajes de ejemplo reales).
3. Implementar en pasos pequeños.
4. Verificar: `pnpm lint && pnpm typecheck && pnpm test` y reportar resultado.
5. Resumir qué cambió y qué revisar.
6. Commit Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`), uno por tarea. Ramas `feat/<nombre>`. Nunca push a `main` sin preguntar.

## Convenciones

- Nada de `any`: usa `unknown` + Zod. Tipos con `z.infer`, sin duplicar.
- Componentes pequeños; Server Components por defecto, `"use client"` solo si hay interactividad.
- Accesibilidad: labels, contraste, teclado. Mobile-first: la hoja debe verse bien a 390 px.
- Sin secretos en el repo: `.env.local` (ignorado) y `.env.example` documentado.

## Comandos

- `pnpm dev` · `pnpm build`
- `pnpm lint` · `pnpm typecheck` (corre `next typegen` + `tsc`) · `pnpm test` · `pnpm test:watch`
- `pnpm format` · `pnpm format:check`
- Añadir componente shadcn: `pnpm dlx shadcn@latest add <name>`
