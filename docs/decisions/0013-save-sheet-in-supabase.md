# 0013 — Guardar la hoja en Supabase (con usuario anónimo)

- Fecha: 2026-11-01
- Estado: aceptada (primer paso de la base de datos de la fase 3)

## Contexto

Desde el ADR 0011 la hoja se guarda en `localStorage`: solo sirve en ese navegador y se pierde si se borran los datos del sitio. Ya existe la cuenta de Supabase, así que el siguiente paso es guardar en la base.

Para guardar en una base compartida hay que saber **de quién es cada hoja**. Si no, cualquiera con la clave pública podría leer o borrar hojas ajenas. Opciones:

1. **Usuario anónimo** (`signInAnonymously`): cada navegador recibe un usuario real de Supabase sin pantalla de login. RLS protege las filas por usuario.
2. **Login con email ya**: la hoja pasa entre dispositivos, pero suma pantalla de login y configurar el envío de emails.
3. **Tabla pública sin usuarios**: lo más simple, pero inseguro.

## Decisión

1. **Usuario anónimo ahora** (elegido por Julian). El login con email queda para el próximo paso; Supabase permite convertir un usuario anónimo en uno con email sin perder sus filas.
2. **Una tabla `characters`** (`supabase/migrations/20261101000000_characters.sql`) con clave `(user_id, character_id)` y una columna `data` (JSONB) que guarda **el mismo sobre que el navegador**: `{ version, savedAt, character }`. Nunca la hoja calculada (como en el ADR 0011).
3. **RLS en la tabla**, con una política por operación: cada usuario (`authenticated`, que incluye a los anónimos) solo ve y cambia sus filas. El rol `anon` (sin sesión) no tiene permisos. Por eso la clave publicable puede estar en el navegador.
4. **Solo `@supabase/supabase-js`** como dependencia nueva, usado desde el navegador. Drizzle y `@supabase/ssr` (sesión en cookies para el servidor) llegan cuando haya páginas de servidor que lean personajes; el plan ya avisa que Drizzle se salta RLS y necesita otro ADR.
5. **La lógica no importa Supabase.** `lib/character-sync.ts` recibe la nube como una interfaz chica (`RemoteCharacterStore`: `load`/`save`/`remove`) y se testea con una nube falsa. La implementación real es `lib/supabase/character-store.ts`.
6. **`localStorage` queda como copia local.** Al abrir la hoja se leen las dos copias, gana la de `savedAt` más nuevo y se igualan. Si la nube está vacía y el navegador tiene algo (lo guardado con el ADR 0011), se sube: **no se pierde nada**.
7. **Un guardado en la nube a la vez.** Cada clic es un cambio; si se mandaran todos juntos podrían llegar desordenados. `createRemoteSaver` manda uno y recuerda solo el último pedido (guardar o borrar) mientras tanto.
8. **Sin variables de entorno, la app funciona como antes** (solo navegador). Así corren los tests, CI y una copia local sin `.env.local`.
9. **La hoja dice dónde se guarda**: "en la nube", "en este navegador" o "no se pudo guardar en la nube".

## Consecuencias

- La hoja sobrevive a borrar `localStorage` mientras la sesión anónima siga (supabase-js también la guarda en el navegador). **Todavía no pasa a otro dispositivo**: eso llega con el login con email.
- Los usuarios anónimos que nunca vuelven quedan en la base. Supabase recomienda limpiarlos cada tanto; se resuelve más adelante.
- Hay que activar "Allow anonymous sign-ins" en Supabase y correr el SQL de la migración una vez (guía en el PR).
