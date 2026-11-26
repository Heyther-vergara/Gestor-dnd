# 0030 — Selector de tema claro, oscuro o del sistema

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

El modo oscuro "cuero y brasa" estaba definido desde ADR 0008 (clase `.dark` en `<html>`), pero nada lo activaba. Jugar de noche con poca luz es un uso real de la app.

## Decisión

- Tres opciones en el pie de página: **Claro**, **Oscuro** y **Sistema** (por defecto). Con Sistema la app sigue la preferencia del teléfono o la computadora, también si cambia con la página abierta.
- Se guarda en `localStorage` (`gestor-dnd:theme`). Es una preferencia del navegador, no del personaje: no va a Supabase.
- Un script inline en `<head>` aplica el tema antes de pintar, para que no se vea un destello claro al cargar en oscuro (guía de Next.js "Preventing flash before hydration"). `<html>` lleva `suppressHydrationWarning` porque el script cambia su clase antes de que React hidrate. La CSP ya permite scripts inline (ADR 0024).
- Sin dependencias nuevas (no `next-themes`): son ~100 líneas propias. La lógica pura está en `src/lib/theme.ts` y un test ejecuta el script inline para comprobar que decide igual que `isDark`.
- El selector usa radios reales (accesibles con teclado y lector de pantalla), con estilo de botones segmentados.
