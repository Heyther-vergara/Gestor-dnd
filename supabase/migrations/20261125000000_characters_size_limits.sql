-- Límites de tamaño en la tabla de personajes (ADR 0023).
-- Se corre una vez en Supabase → SQL Editor, después de la migración inicial.
--
-- Por qué: la clave publicable es pública a propósito y RLS impide ver lo
-- ajeno, pero no impide que alguien cree un usuario anónimo y guarde filas de
-- varios MB. Estos `check` los rechaza la base misma, aunque alguien salte la
-- app y hable directo con la API (SOC 2 CC6.6 · ISO 27001 A.8.6).
--
-- Los topes son holgados: el esquema del personaje ya limita sus listas
-- (inventario, elecciones) a 200 elementos, y el id es un UUID (36 caracteres). 64 coincide con LIMITS.id en
-- `src/rules-engine/schemas/limits.ts`.

alter table public.characters
  add constraint characters_character_id_length
    check (char_length(character_id) between 1 and 64),
  add constraint characters_data_size
    check (octet_length(data::text) <= 262144); -- 256 KB
