# 0025 — Hoja responsive con desplegables

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

La hoja era una sola columna de 672 px (`max-w-2xl`) en todas las pantallas. En el celular medía unas 5 pantallas de alto y en escritorio dejaba mucho espacio vacío. Se propusieron tres direcciones de diseño sobre la paleta "Pergamino sobrio" (ADR 0008); se empieza por la estructura (dirección A) y el dueño pidió un desplegable para el libro de conjuros (con la información y los espacios de conjuro) y otro para el equipo.

## Decisión

- **Cabecera fija** (`SheetHeader`, `position: sticky`): nombre, subtítulo, PG con barra y CA siempre a la vista al bajar.
- **Desplegables** (`Foldout`) para Libro de conjuros, Equipo y Rasgos. Cerrados muestran un resumen de una línea ("CD 12 · Ataque +4 · Espacios 4·2", "12 objetos · 18 po"). Usan `<details>`/`<summary>` del navegador: accesibles con teclado y lector de pantalla, sin JavaScript ni dependencias.
- **Dos columnas desde `lg` (1024 px)**: a la izquierda lo de combate (números, PG, controles, características, habilidades); a la derecha lo que se consulta (recursos, conjuros, equipo, rasgos). En pantallas más chicas sigue siendo una columna (mobile-first).
- Los espacios de conjuro se ven como círculos, uno por espacio. Todavía no se marcan como gastados.
- Los objetos homebrew pasan a estar dentro del desplegable de Equipo.

### Por qué no pestañas

Se pensó en pestañas para el celular, pero con desplegables cerrados la hoja ya se acorta mucho y todo queda en una sola página (también sirve para buscar con Ctrl+F). Pestañas y desplegables a la vez serían dos formas de esconder lo mismo.

## Consecuencias

- Siguientes pasos de diseño: botones rápidos de daño/curación en la cabecera, piezas de la dirección "Grimorio" (escudo de CA, medallones) y selector de tema claro/oscuro.
- Marcar espacios de conjuro gastados necesita estado de partida nuevo en el motor (otra tarea).
