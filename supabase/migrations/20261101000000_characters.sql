-- Tabla de personajes guardados (ADR 0013).
-- Se corre una vez en Supabase → SQL Editor (o con la CLI de Supabase).
--
-- Guarda solo el personaje (elecciones + estado de partida) dentro del mismo
-- sobre que usa el navegador: { version, savedAt, character }. Nunca la hoja
-- calculada: la app la recalcula con el motor al cargar.

create table if not exists public.characters (
  -- Dueño de la fila. Por defecto, el usuario que hace la petición.
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  -- El id del personaje dentro de la app (por ejemplo, el de la hoja de ejemplo).
  character_id text not null,
  -- El sobre con versión, validado con Zod al leerlo.
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, character_id)
);

-- Row Level Security: sin políticas, nadie puede leer ni escribir nada.
-- Las políticas de abajo abren solo las filas propias.
alter table public.characters enable row level security;

-- Los usuarios anónimos de Supabase también usan el rol `authenticated`, así
-- que estas políticas los cubren. `(select auth.uid())` se calcula una sola
-- vez por consulta en vez de una vez por fila.
create policy "Ver mis personajes"
  on public.characters for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Crear mis personajes"
  on public.characters for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Editar mis personajes"
  on public.characters for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Borrar mis personajes"
  on public.characters for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Permisos de tabla para la API. RLS igual filtra fila por fila.
-- El rol `anon` (alguien sin sesión) no recibe nada.
grant select, insert, update, delete on public.characters to authenticated;
revoke all on public.characters from anon;
