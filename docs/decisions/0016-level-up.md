# 0016 — Subir de nivel del 2 al 5

- Fecha: 2026-11-13
- Estado: aceptada

## Contexto

El creador (ADR 0015) hace personajes de nivel 1. El criterio del MVP pide niveles 1 a 5. El motor ya calculaba PG, dados de golpe y bonificador por competencia para cualquier nivel; faltaba poder _subir_ y guardar las elecciones que trae cada nivel (SRD 5.2.1, "Subir de nivel").

## Decisión

1. **Contenido:** el script de importación trae las subclases del SRD para las clases del paquete (Campeón y Evocador, `subclasses.json`) y la tabla de espacios de conjuro de cada clase (`spellcasting.slotsByLevel`). Va en los datos para que una clase homebrew traiga su propia tabla.
2. **Rasgos que piden una elección** se marcan con `grants` (`"subclass"` o `"ability-score-improvement"`), no por el nombre. El motor y la pantalla leen esa marca, así una clase homebrew puede pedir la subclase en otro nivel.
3. **Personaje:** `classes[].subclassId` opcional y una elección nueva `ability-score-improvement` (dote "Mejora de característica": +2 a una o +1 a dos, tope 20). Su `level` es el nivel de la clase del rasgo que la dio; el motor acepta una sola por rasgo.
4. **Motor:** aplica la mejora (después del aumento del trasfondo), los rasgos de la subclase hasta el nivel de la clase y devuelve `features` (rasgos ganados) y `spellcasting[].slots`. Avisa en `issues` si la subclase es de otra clase, se eligió antes de tiempo o una mejora no corresponde.
5. **Lógica pura `lib/level-up.ts`** (como el creador): qué trae el próximo nivel, errores de cada elección, el personaje nuevo y los PG que suma (la diferencia entre la hoja de antes y la de después). La pantalla `/characters/[id]/level-up` solo muestra eso y guarda.
6. **PG con el valor fijo** de la tabla "Puntos de golpe establecidos por clase", sin tirar: es regla oficial y no obliga a guardar cada tirada.

## Consecuencias

- La hoja muestra una sección "Conjuros" (CD, ataque y espacios) y "Rasgos" (texto del SRD en inglés, como el resto del contenido importado).
- Quedan afuera: tirar los PG, elegir otra dote en vez de la mejora (el paquete no tiene dotes generales), conjuros nuevos del mago (no hay selección de conjuros todavía), multiclase (incluida la tabla combinada de espacios), bajar de nivel y niveles 6+.
