# 0023 — Límites de tamaño para los datos que entran

- Fecha: 2026-11-25
- Estado: aceptada

## Contexto

Paso 2 del hardening (ADR 0022). Todo lo que entra de afuera ya se validaba con Zod, pero sin topes de tamaño:

- Importar una clase homebrew leía el archivo entero sin mirar cuánto pesaba. Uno de cientos de MB congela la pestaña.
- Los textos y listas del esquema de contenido no tenían largo máximo, y un efecto podía valer +1000 a la CA.
- La tabla `characters` aceptaba filas de cualquier tamaño. La clave publicable es pública a propósito y RLS impide ver lo ajeno, pero no impide llenar la base.
- `list()` creaba un usuario anónimo en cada visita a "Mis personajes", aunque la persona no guardara nada. Un bot que ejecuta JavaScript crea un usuario por visita.

Controles: SOC 2 CC6.6 (protección frente a amenazas externas) · ISO 27001 A.8.6 (gestión de capacidad) y A.8.26 (requisitos de seguridad de las aplicaciones).

## Decisión

1. **Topes en el esquema** (`src/rules-engine/schemas/limits.ts`): nombres hasta 100 caracteres, textos hasta 20.000, ids hasta 64, listas hasta 200, efectos por contenido hasta 50 y valor de un efecto entre −1000 y 1000. Son muy holgados: el SRD 5.2.1 llega a unos 3.000 caracteres de texto, 30 de nombre y un efecto de 120 (visión en la oscuridad). Como el SRD, el homebrew y los personajes usan los mismos esquemas, el tope vale para todo lo que entra: archivos, localStorage y Supabase.
2. **Archivo de clase hasta 1 MB**, revisado con `file.size` **antes** de leerlo, y otra vez en `parseClassFile` como defensa en profundidad. El Alquimista pesa unos 12 KB.
3. **Migración nueva** con `check` en la base: `character_id` de 1 a 64 caracteres y `data` hasta 256 KB. La base los aplica aunque alguien hable directo con la API, sin pasar por la app.
4. **Solo `save` crea el usuario anónimo.** `load`, `list` y `remove` sin sesión devuelven vacío sin tocar la nube: un usuario nuevo no tiene filas.

## Consecuencias

- Un archivo o personaje que supere un tope se rechaza con un mensaje, en vez de congelar la pestaña o llenar la base.
- La migración la corre el dueño en Supabase → SQL Editor. Si alguna fila vieja ya superara un tope, el `alter table` fallaría y habría que revisarla antes; con los datos actuales no debería pasar.
- Queda fuera de la app, en el panel de Supabase: el límite de logins anónimos por IP y el CAPTCHA (Turnstile) para logins anónimos.
- Pendiente: un tope de filas por usuario y la limpieza de usuarios anónimos viejos sin personajes.
