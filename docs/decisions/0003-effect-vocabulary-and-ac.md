# 0003 — Vocabulario cerrado de efectos y una sola forma de calcular la CA

- Fecha: 2026-10-15
- Estado: aceptada

## Contexto

Antes de escribir `calculateSheet` había dos problemas en los esquemas:

1. **`target` y `condition` eran texto libre.** Un typo (`"acc"` en vez de `"ac"`) pasaba la validación y el motor lo habría ignorado sin avisar. El ADR 0002 ya dejaba anotado cerrar el vocabulario en la fase 2.
2. **La CA se podía expresar de dos formas:** con `data.armor.baseAc` / `dexCap` del objeto, y con efectos `{ target: "ac", op: "base" }` (con `abilities` y `maxAbilityBonus`). El motor tendría que decidir cuál manda y qué pasa si las dos dicen cosas distintas.

Reglas del SRD 5.2.1 que hay que poder expresar:

- Glosario, "Clase de armadura": la CA base es 10 + Des; si una regla da otro cálculo, se usa uno solo.
- "Armaduras": cuero 11 + Des · media 14 + Des (máx. 2) · cota de malla 16.
- Bárbaro, "Defensa sin armadura": 10 + Des + Con sin armadura, aunque lleve escudo.
- Monje, "Defensa sin armadura": 10 + Des + Sab sin armadura ni escudo.
- Conjuro "Armadura de mago": 13 + Des si no lleva armadura.

## Decisión

### 1. `target` es una lista cerrada (`src/rules-engine/schemas/effect.ts`)

- **Numéricos:** `ac`, `initiative`, `speed`, `hp.max`, `hp.max-per-level`, `senses.darkvision`, `spell.attack`, `spell.dc`, `ability.<atributo>`, `save.<atributo>`, `skill.<habilidad>`.
- **Concesiones (`op: "grant"`):** `proficiency.skill.<habilidad>`, `proficiency.save.<atributo>`, `proficiency.armor.<light|medium|heavy|shield>`, `proficiency.weapon.<simple|martial>`.
- Los numéricos solo aceptan operaciones numéricas y las concesiones solo `grant`: `{ target: "ac", op: "grant" }` es un error.
- Se arman con `z.templateLiteral` reutilizando `abilitySchema` y `skillSchema`, así una habilidad nueva no hay que escribirla dos veces y TypeScript conoce cada ruta válida.

### 2. `condition` es una lista cerrada

`unarmored` (sin armadura; el escudo no importa) y `unarmored-no-shield` (sin armadura ni escudo). Se agregan más cuando aparezca contenido que las necesite.

### 3. La CA sale **solo** de efectos

- Se quitan `baseAc` y `dexCap` de `data.armor`. Ahí quedan solo datos que no son CA: categoría, Fuerza mínima y desventaja en Sigilo.
- Cada armadura declara su CA con **exactamente un** efecto `{ target: "ac", op: "base", ... }`. El esquema rechaza una armadura sin ese efecto.
- El escudo es `{ target: "ac", op: "add", value: 2 }`.
- El motor agrega siempre la base implícita 10 + Des y, entre todas las bases cuyas condiciones se cumplen, usa la mayor (el SRD deja elegir; elegir la mayor es lo que haría cualquier jugador y evita guardar otra elección). Después aplica `set → add → multiply → min/max`.
- "Llevar armadura" lo deduce el motor de los objetos equipados con `category: "armor"`; "portar escudo", de los equipados con `category: "shield"`.

## Opciones descartadas

- **CA solo en `data.armor`:** sirve para armaduras, pero Defensa sin armadura y Armadura de mago no son objetos y necesitarían efectos igual. Seguiríamos con dos caminos.
- **Mantener los dos caminos con una regla de prioridad:** más casos que testear y una fuente de bugs silenciosos.

## Consecuencias

- Agregar un `target` o una `condition` nuevos es sumarlo a la lista en `effect.ts` (y enseñarle al motor a usarlo). Es a propósito: obliga a pensar si el motor lo sabe calcular.
- Cuando se importen armaduras al paquete SRD, el script tiene que convertir la CA de 5e-bits en un efecto `base`.
- Fuera de alcance por ahora: competencias con herramientas y pericia. Se agregan cuando haya contenido que las use. (Las resistencias se agregaron en el ADR 0012.)
