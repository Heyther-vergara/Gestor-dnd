# 0011 — Guardar la hoja en el navegador (antes de Supabase)

- Fecha: 2026-10-30
- Estado: aceptada (paso previo a la base de datos de la fase 3)

## Contexto

La hoja de ejemplo (`/sheet/example`) se puede usar en partida (ADR 0009 y 0010), pero el estado vive solo en memoria: al recargar la página se pierden el daño, los dados de golpe y las salvaciones contra muerte.

El plan elige Postgres en Supabase + Drizzle + Supabase Auth para la fase 3. Eso necesita crear el proyecto en Supabase, cargar claves, agregar dependencias y resolver login y permisos (RLS). Es un paso grande y todavía no hay cuentas creadas.

Opciones:

1. **Guardar en el navegador (`localStorage`).** Sin cuentas ni dependencias. Solo sirve en ese navegador y ese dispositivo.
2. **Ir directo a Supabase.** Es el destino final, pero bloquea el avance hasta que existan las cuentas y suma login, migraciones y RLS de una vez.

## Decisión

1. **Primero `localStorage`**, como paso chico. Supabase sigue siendo el destino de la fase 3 y no cambia.
2. **Se guarda solo el personaje** (elecciones + `playState`), nunca la hoja calculada: al cargar, el motor la recalcula. Es la misma regla que tendrá la base de datos.
3. **Formato con versión**: `{ version: 1, savedAt, character }` bajo la clave `gestor-dnd:character:<id>`. Si cambia el formato, la versión permite migrar en vez de perder datos.
4. **Lo guardado se valida con Zod** (`characterSchema`) al leerlo, como cualquier dato externo: el usuario puede editarlo a mano o puede venir de una versión vieja de la app. Si no valida, se ignora y la hoja arranca con el personaje inicial.
5. **`lib/character-storage.ts` recibe el almacenamiento como parámetro** (`getItem`/`setItem`/`removeItem`). Así se testea en Node con un almacenamiento falso, y cambiarlo por la base de datos toca un solo lugar.
6. **Carga después de montar.** El servidor no tiene `localStorage`; si el primer render del cliente fuera distinto al del servidor, React daría error de hidratación. Por eso se lee en un `useEffect` y la hoja muestra el personaje inicial un instante.
7. **Un reducer para la hoja guardada** (`lib/saved-sheet-reducer.ts`) envuelve al de partida y suma el estado del guardado (`loading` → `saved` o `unavailable`). "Terminó la carga" cambia el personaje y el estado a la vez, con un solo `dispatch`. Esto también cumple la regla de ESLint `react-hooks/set-state-in-effect`.
8. **"Volver al estado inicial" borra lo guardado.**
9. **Si el navegador no deja guardar** (modo privado, sin espacio), la hoja sigue funcionando y avisa que los cambios se pierden al recargar.

## Consecuencias

- Recargar la página ya no borra la partida.
- Los datos no pasan de un dispositivo a otro ni sobreviven a borrar los datos del sitio. Eso lo resuelve Supabase en la fase 3.
- Cuando llegue la base de datos, `character-storage` se reemplaza (o queda como copia local) sin tocar el motor ni la interfaz de partida.
