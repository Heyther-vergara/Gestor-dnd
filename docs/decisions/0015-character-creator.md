# 0015 — Creador de personajes de nivel 1 y varias hojas por usuario

- Fecha: 2026-11-12
- Estado: aceptada

## Contexto

Hasta ahora la app tenía una sola hoja, la de ejemplo (`/sheet/example`), con un personaje escrito en el código. No había forma de crear un personaje propio, que es el criterio de la fase 3: "crear, guardar y reabrir un personaje en el móvil".

La base ya estaba lista para varias hojas: la tabla `characters` (ADR 0013) tiene una fila por usuario **y por personaje**.

## Decisión

1. **Tres pantallas nuevas:**
   - `/characters` ("Mis personajes"): junta los personajes de la nube y del navegador (`listCharacters`). Si uno está en los dos lados, gana la copia más nueva, igual que al abrir la hoja.
   - `/characters/new`: creador paso a paso, un paso por pantalla (nombre, especie y tamaño, clase y habilidades, trasfondo y aumentos, características, resumen).
   - `/characters/[id]`: la hoja jugable de siempre (`PlayableSheet`), con el personaje que se busca en lo guardado.
2. **Las reglas del creador son lógica pura** (`lib/character-builder.ts`): recibe el borrador y el contenido, y devuelve los errores de cada paso o un `Character`. La pantalla no decide nada; solo muestra lo que dice ese módulo. Así se testea sin navegador.
3. **El personaje creado solo guarda elecciones**, como siempre: clase de nivel 1, especie, trasfondo, puntuaciones base y las elecciones (`ability-bonus`, `skills` y, si la especie ofrece más de un tamaño, `size`). La hoja la calcula el motor.
4. **Conjunto estándar** (SRD 5.2.1, "Paso 3": 15, 14, 13, 12, 10 y 8), con el botón "Usar el reparto sugerido para la clase" de la tabla "Conjunto estándar por clase". Es el método más simple de validar y de usar en el celular. Tirar dados y comprar por puntos quedan para después.
5. **Id con `crypto.randomUUID()`**, generado en el navegador. Es único sin preguntarle a la base.
6. **"Volver al estado inicial" no borra un personaje creado.** En la hoja de ejemplo borra lo guardado (el personaje vive en el código). En un personaje creado borrar lo guardado sería perder el personaje, así que `PlayableSheet` recibe `resetMode="keep"` y guarda el personaje con el estado de partida en cero.
7. **Nombres en español** de clases, especies y trasfondos (`contentName` en `lib/format.ts`), tomados del SRD en español: el Sage es "Erudito".

## Consecuencias

- Con solo usuario anónimo (ADR 0014, actualización), los personajes quedan atados a este navegador. Si se borran los datos del navegador, la sesión anónima se pierde y con ella el acceso a los personajes de la nube. Volver a activar una cuenta lo resuelve.
- Habilidades repetidas: si una habilidad de la clase ya la da el trasfondo, el resumen avisa que elegirla no suma nada (la competencia no se acumula), pero no se prohíbe.
- Quedan afuera: equipo inicial, la dote del trasfondo, las elecciones extra del humano (habilidad y dote de origen), los conjuros del mago, subir de nivel y borrar personajes.
