# 0001 — Ubicación del proyecto y tooling base

- Fecha: 2026-09-29
- Estado: aceptada

## Contexto

Arranque de la fase 0. El proyecto iba a vivir en `OneDrive\Documentos`, y había que elegir cómo fijar versiones de Node y pnpm para que local, CI y Vercel coincidan.

## Decisión

1. **Proyecto en `C:\dev\gestor-dnd`, fuera de OneDrive.** OneDrive intenta sincronizar `node_modules` (decenas de miles de archivos) y bloquea archivos mientras pnpm instala. El respaldo lo da git + GitHub.
2. **pnpm instalado con `npm install -g pnpm`** (no con `corepack enable`, que pedía permisos de administrador porque Node está en `Program Files`). La versión queda fijada en `package.json` → `packageManager`; CI la lee de ahí.
3. **Node 24** fijado en `.nvmrc` y `engines`.
4. **ESLint directo** (`eslint .`, config plana) en lugar de `next lint`.
5. **`typecheck` = `next typegen && tsc --noEmit`**: Next 16 genera tipos globales como `LayoutProps` en `.next/`, que no existe en CI.
6. **Vitest config en `.mts`** para que Vite la cargue como ESM sin poner `"type": "module"` en todo el proyecto.
7. **shadcn/ui con base Radix y preset Nova.** Usa el paquete `cn` (de shadcn) en lugar de `clsx` + `tailwind-merge`.
8. Las librerías de fases futuras (Zod, Supabase, Drizzle, Zustand, TanStack Query, RHF, Playwright) se instalan cuando se usan.

## Consecuencias

- Hay que clonar/abrir el proyecto desde `C:\dev\gestor-dnd`, no desde OneDrive.
- Actualizar pnpm = cambiar `packageManager` y reinstalar el pnpm global.
