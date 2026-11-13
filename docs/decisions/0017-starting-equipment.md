# 0017 — Equipo inicial al crear personaje

- Fecha: 2026-11-13
- Estado: aceptada

## Contexto

El creador (ADR 0015) dejaba el inventario vacío. En el SRD 5.2.1 ("Elige el equipo inicial") la clase y el trasfondo dan cada uno parte del equipo, con opciones del tipo "Elige A o B" (el guerrero tiene A, B o C). El paquete solo tenía armas, armaduras y escudo; el equipo de clase y trasfondo era texto suelto, y el personaje no tenía dónde guardar monedas.

## Decisión

1. **Equipo inicial estructurado en el contenido:** `startingEquipment` en clase y trasfondo es una lista de opciones; cada opción tiene objetos (`{ itemIds, quantity }`) y `gp`. Reemplaza el texto `equipment` del trasfondo. Con texto la app no podía llenar el inventario ni sumar la CA de la armadura.
2. **"Elegí uno" en los datos:** una entrada con varios `itemIds` es una elección (símbolo sagrado del acólito: amuleto, emblema o relicario; juego del soldado). Sirve igual para homebrew.
3. **Se escribe a mano en el script de importación**, citando el SRD en español, porque 5e-bits lo trae como texto. Del resto del equipo (paquetes, libro de conjuros, flechas…) se importan solo los objetos que aparecen en el equipo inicial, como `gear` o `tool`, sin efectos.
4. **Personaje:** `coins` (`cp`, `sp`, `ep`, `gp`, `pp`) junto al inventario. Es estado, no un valor derivado: se gana y se gasta jugando. Por defecto, cero, así los personajes guardados antes siguen abriendo.
5. **Creador:** paso "Equipo" después de las características. La lógica está en `lib/character-builder.ts` (`startingEquipment`): junta en una entrada el mismo objeto de clase y trasfondo (el mago erudito tiene dos bastones) y deja **equipadas** la primera armadura y el primer escudo, así la CA de la hoja ya los cuenta.
6. **Hoja:** sección "Equipo" de solo lectura con los objetos, cuáles están equipados y las monedas.

## Consecuencias

- El precio de la munición viene por paquete de 5e-bits (las flechas, 1 po las 20); no se usa todavía.
- Quedan afuera: comprar con las monedas, equipar o desequipar desde la hoja, ataques con armas y la competencia con herramientas del trasfondo (el juego del soldado se elige solo como objeto).
