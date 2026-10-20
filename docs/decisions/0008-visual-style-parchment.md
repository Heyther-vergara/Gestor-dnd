# 0008 — Estilo visual "Pergamino sobrio"

- Fecha: 2026-10-20
- Estado: aceptada

## Contexto

La app todavía no muestra la hoja. Antes de construir componentes hay que elegir un estilo, porque shadcn/ui toma todos los colores de variables CSS (`--background`, `--primary`, `--border`…) definidas en `src/app/globals.css`. Lo que se elija ahí lo heredan todos los componentes sin tocarlos.

Se compararon tres direcciones con una ficha de ejemplo en claro y oscuro: **A · Pergamino sobrio**, **B · Mesa nocturna** (oscuro moderno, ámbar) y **C · Ficha limpia** (gris de shadcn + índigo).

## Decisión

Se usa **A · Pergamino sobrio**:

| Rol                                | Claro     | Oscuro    |
| ---------------------------------- | --------- | --------- |
| Fondo (`--background`)             | `#F4ECDC` | `#1A1410` |
| Tarjeta (`--card`)                 | `#FBF6EC` | `#241C16` |
| Texto (`--foreground`)             | `#2A1F16` | `#EFE4D0` |
| Texto suave (`--muted-foreground`) | `#6B5A48` | `#B3A28A` |
| Principal (`--primary`)            | `#8E2420` | `#E07060` |
| Dorado (`--gold`, competencias)    | `#8A6516` | `#D4A84A` |
| PG / éxito (`--success`)           | `#3F6B3A` | `#8DBF78` |
| Daño / alerta (`--destructive`)    | `#B3261E` | `#F07167` |
| Borde (`--border`)                 | `#D9C9AE` | `#3A2E24` |

- Fuentes: **Alegreya SC** (versalitas con serifa) solo para títulos (`font-heading`); **Alegreya Sans** para texto y números (`font-sans`). Se cargan con `next/font/google`, que las sirve desde el propio dominio.
- `--gold` y `--success` son tokens propios, expuestos a Tailwind como `text-gold`, `bg-success`, etc.
- Radio más chico (`--radius: 0.375rem`): esquinas casi rectas, como una ficha de papel.

### Por qué

- Es una app de rol en un portafolio: una identidad visual reconocible suma, y como todo vive en variables cuesta lo mismo que la opción minimalista.
- Se reconoce como hoja de rol sin usar marcas, logos ni arte oficial (ver reglas legales en `CLAUDE.md`).
- Todos los pares de texto y fondo pasan WCAG AA (4,5:1) en claro y oscuro.

### Reglas para que no se vuelva un disfraz

- Decoración (versalitas, bordes dobles) solo en títulos y marcos. Nada de texturas de imagen.
- Los números de la hoja siempre en sans, con `tabular-nums` y buen tamaño.

## Consecuencias

- El modo oscuro está definido pero se activa con la clase `.dark` en `<html>`; falta un selector de tema (o seguir la preferencia del sistema). Se decide cuando se construya la hoja.
- Geist deja de usarse para texto; Geist Mono queda solo para código (`font-mono`).
