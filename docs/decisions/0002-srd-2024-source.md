# 0002 — Fuente del contenido SRD 2024

- Fecha: 2026-09-29
- Estado: aceptada

## Contexto

La fase 1 necesita un subconjunto del SRD 5.2.1 en nuestro formato JSON (2 clases, 3 especies, 3 trasfondos, 20 conjuros). Wizards publica el SRD 5.2.1 como PDF bajo CC-BY-4.0.

## Opciones consideradas

- **Transcribir a mano del PDF:** control total, pero lento y propenso a errores; no escala al SRD completo.
- **Parsear un repo en Markdown** (p. ej. `downfallx/dnd-5e-srd-markdown`): hay que escribir un parser frágil.
- **Convertir el JSON de `5e-bits/5e-database`** (MIT, ~940 estrellas, activo): ya tiene el SRD 2024 casi completo en JSON estructurado.

## Decisión

Script `scripts/import-srd-2024.mts` (`pnpm content:import`) que descarga el JSON 2024 de 5e-bits **en un commit fijo** y lo convierte a nuestro esquema. Los archivos generados se versionan en `src/content/srd-2024/` y el test `src/content/__tests__/srd-2024.test.ts` los valida con Zod.

- Los `effects` y las correcciones se escriben a mano dentro del script (`TRAIT_EFFECTS`, `SIZE_OVERRIDES`) para que sobrevivan a una reimportación.
- Sin dependencias nuevas: Node 24 ejecuta TypeScript directamente.

## Licencias y atribución

- Texto del SRD 5.2.1: Wizards of the Coast LLC, CC-BY-4.0 → atribución en la página de créditos.
- Estructura JSON: 5e-bits, MIT → incluir su aviso de copyright MIT en créditos. (Su README menciona la OGL 1.0a, pero el SRD 5.2.1 se publicó bajo CC-BY-4.0.)

## Consecuencias y pendientes

- Errores detectados en 5e-bits: el humano figura solo como Mediano (en el SRD es Mediano o Pequeño) → corregido con `SIZE_OVERRIDES`.
- No se modelan aún los **linajes** (subespecies: elfo, gnomo, tiflin…), por eso las especies elegidas son enano, humano y mediano. Pendiente para la v1.
- La dote _Magic Initiate_ depende de una lista de conjuros (clérigo para acólito, mago para sabio); el trasfondo aún no guarda ese parámetro. Pendiente para la fase 3 (creador de personaje).
- `toolProficiency` es texto libre; a veces es una elección ("Choose one kind of Gaming Set").
- El vocabulario de `target` de los efectos se cierra en la fase 2.
