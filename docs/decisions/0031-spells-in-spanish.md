# 0031 — Conjuros con el texto oficial del SRD en español

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

Los 110 conjuros del mago (ADR 0021) tenían nombre y texto en inglés, porque vienen de 5e-bits, que solo publica el SRD en inglés. El resto de la app ya está en español.

Wizards publica el SRD 5.2.1 también en español, con la misma licencia CC-BY-4.0. Es la **misma versión** que usa la app (5e-bits importa el SRD 5.2.1 en inglés, ADR 0002), así que no hay diferencias de reglas: cambia el idioma, no el contenido.

## Decisión

1. **Copiar, no traducir.** Nombre, tiempo de lanzamiento, alcance, componentes, duración y descripción salen tal cual del SRD en español. Una traducción propia podría cambiar una regla sin querer; el texto oficial no.
2. **Script reproducible** `scripts/translate-spells-es.mts` (`pnpm content:spells-es`). Lee el texto del PDF (`docs/reference/srd-5.2.1-es.txt`, fuera de git) y reescribe `spells.json`. Hay que correrlo después de `pnpm content:import`, que vuelve a dejar los conjuros en inglés.
   - Una tabla escrita a mano une cada id de 5e-bits con su nombre en español ("fireball" → "Bola de fuego"). El script comprueba que el conjuro encontrado tenga el mismo nivel y escuela, y falla si falta alguno o si alguno queda sin texto.
   - Arregla lo que deja el PDF: une las líneas cortadas por el ancho de la columna, quita los pies de página y los guiones de corte, y toma de otro lugar el texto de "Detectar pensamientos", que el PDF guarda dentro de "Destierro".
3. **Los ids siguen en inglés** (`fireball`). Los personajes guardados y las copias de seguridad los usan: cambiarlos rompería los que ya existen. Solo cambia lo que se ve.
4. **Concentración, ritual y componentes salen del texto en español.** Al compararlo, 5e-bits tenía dos errores:
   - "Protección contra el bien y el mal" sin concentración, aunque su propia duración dice "Concentration up to 10 minutes".
   - "Patrón hipnótico" sin componente verbal. El SRD en español dice "V, S, M".
5. **Metros, como el libro.** El SRD en español usa metros ("45 m"). Las armas y la velocidad siguen en pies; pasarlas es otro cambio.
6. Las listas se ordenan por nombre con `localeCompare(…, "es")`, con las reglas del español para tildes y eñes.
7. La escuela "Ilusión" pasa a "Ilusionismo", el nombre que usa el SRD en español.

## Consecuencias

- La hoja, el creador y subir de nivel muestran los conjuros en español. El orden de las listas cambia porque ahora es alfabético en español.
- Los créditos dicen que los textos de los conjuros son los del SRD 5.2.1 en español.
- `spells.json` pesa casi lo mismo (unos 130 KB); el texto más largo tiene unos 2.900 caracteres, lejos del tope de 20.000 (ADR 0023).
- El PDF trae algunas palabras pegadas ("lafallan") y una tabla ("Augurio") queda como líneas sueltas. Se dejan como están para no tocar el texto oficial a mano.
- Quedan en inglés los rasgos de clase, especies, trasfondos, dotes y objetos. Se pueden pasar igual, con el mismo método.
