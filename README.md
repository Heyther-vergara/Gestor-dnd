# Gestor de personajes 5e

App web responsive para crear y gestionar hojas de personaje **compatibles con 5e** (reglas SRD 5.1 y SRD 5.2.1), con contenido homebrew activable por personaje.

Proyecto de portafolio y aprendizaje. Plan completo en [docs/plan.md](docs/plan.md).

## Stack

Next.js (App Router) · React · TypeScript estricto · Tailwind CSS + shadcn/ui · Vitest · pnpm.
Próximas fases: Zod, Supabase (Postgres + Auth), Drizzle ORM, Zustand, TanStack Query, Playwright.

## Empezar

Requisitos: Node 24 y pnpm (`npm install -g pnpm`).

```bash
pnpm install
cp .env.example .env.local   # y rellena los valores
pnpm dev                     # http://localhost:3000
```

## Comandos

| Comando             | Qué hace                            |
| ------------------- | ----------------------------------- |
| `pnpm dev`          | Servidor de desarrollo              |
| `pnpm build`        | Build de producción                 |
| `pnpm lint`         | ESLint                              |
| `pnpm typecheck`    | Genera tipos de rutas y corre `tsc` |
| `pnpm test`         | Tests unitarios (Vitest)            |
| `pnpm format`       | Formatea con Prettier               |
| `pnpm format:check` | Comprueba el formato (lo usa CI)    |

## Licencia del contenido

Este proyecto usará material del System Reference Document 5.1 y 5.2.1 de Wizards of the Coast LLC, disponible bajo licencia [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/legalcode). La atribución completa estará en la página de créditos de la app.

No es un producto oficial ni está afiliado a Wizards of the Coast.
