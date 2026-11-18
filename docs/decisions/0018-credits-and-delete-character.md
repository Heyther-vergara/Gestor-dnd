# 0018 — Página de créditos y borrar personajes

- Fecha: 2026-11-18
- Estado: aceptada

## Contexto

La revisión del 2026-11-18 marcó dos faltantes para el MVP:

- El SRD 5.2.1 se usa bajo CC-BY-4.0, que exige mostrar la atribución en la obra. Hasta ahora solo estaba en el README, que quien usa la app no ve.
- "Mis personajes" no permitía borrar: los personajes de prueba quedaban para siempre.

## Decisión

### Créditos

1. Página `/credits` con la declaración de atribución **copiada tal cual** de la sección "Información legal" del SRD 5.2.1 en español. El mismo documento pide no agregar otras atribuciones a Wizards, así que no se agrega nada más sobre ellos.
2. Una nota de que el contenido se adaptó a un formato de datos propio (CC-BY pide indicar si hubo cambios).
3. El aviso completo de la licencia MIT de 5e-bits/5e-database, de donde sale la estructura JSON (ADR 0002).
4. Enlace "Créditos y licencias" en un pie común a todas las páginas (`layout.tsx`), para que la atribución se encuentre desde cualquier lado.
5. Solo se atribuye el SRD 5.2.1 porque es el único que usa la app hoy. Cuando entre el contenido 2014 (v1) se agrega la declaración del SRD 5.1.

### Borrar personajes

1. `deleteCharacter` en `lib/character-sync.ts` borra **primero en la nube y después en el navegador**. Si la nube falla (sin conexión) no toca nada y avisa. Al revés, el personaje desaparecería del navegador pero volvería en la lista desde la nube.
2. Botón "Borrar" en cada fila de "Mis personajes", con confirmación en la misma fila ("¿Borrar a X? No se puede deshacer"). No se usa `confirm()` del navegador porque no se puede estilar y algunos celulares lo bloquean. Al abrir la confirmación el foco pasa a "Cancelar", la opción segura.
3. No se agregan dependencias: la confirmación es un estado del componente, sin diálogo de shadcn.

## Consecuencias

- Borrar no se puede deshacer: no hay papelera.
- Sin conexión no se puede borrar un personaje que está en la nube. Es a propósito: es mejor que avisar "borrado" y que reaparezca.
- Si el mismo usuario tiene la lista abierta en otro dispositivo, ahí el personaje sigue visible hasta recargar.
