# 0004 — Competencia, salvaciones, habilidades y pericia

- Fecha: 2026-10-15
- Estado: aceptada

## Contexto

Segundo tramo de `calculateSheet`: bonificador por competencia, tiradas de salvación y habilidades. Reglas del SRD 5.2.1 que hay que cubrir:

- "Cómo jugar", tabla "Bonificador por competencia": +2 hasta nivel 4, +1 cada 4 niveles (17–20 → +6).
- "Multiclase": el bonificador usa el **nivel total** del personaje.
- "Convertirse en <clase>", "Como personaje multiclase": la clase nueva no da salvaciones.
- "El bonificador no se acumula": aunque la competencia venga de varios lados, se suma una vez.
- Glosario, "Pericia": duplica el bonificador en una habilidad en la que **ya** sos competente.
- "Rellena los números": Percepción pasiva = 10 + modificador de Sabiduría (Percepción).

## Decisión

1. **Salvaciones:** de `data.savingThrows` de la **primera** clase de `character.classes` (la inicial) + efectos `grant` `proficiency.save.<atributo>`. Después se aplican los efectos numéricos `save.<atributo>` (p. ej. Anillo de protección +1).
2. **Habilidades competentes:** las dos del trasfondo + elecciones `kind: "skills"` + efectos `grant` `proficiency.skill.<habilidad>`. Se guardan en un conjunto, así que repetirlas no suma dos veces.
3. **Elecciones de habilidades:** el `contentId` tiene que ser contenido que el personaje tiene. Si es una clase, se valida contra `skillChoices` (opciones y cantidad). Especies y dotes todavía no declaran sus opciones, así que por ahora se aceptan.
4. **Pericia como elección** (`kind: "expertise"`), no como efecto: en el SRD siempre se elige (mago "Erudito", pícaro, bardo). Si la habilidad no es competente, se ignora y va a `issues`.
5. Las habilidades se calculan con la tabla `skillAbilities` (`schemas/common.ts`), que dice qué característica usa cada una.

## Consecuencias

- La hoja expone `proficiencyBonus`, `savingThrows`, `skills` (con `none | proficient | expertise`) y `passivePerception`.
- El orden de `classes` importa: la primera es la clase inicial.
- Pendiente: validar cantidad de habilidades en multiclase (la clase nueva da menos) y que la pericia venga de un rasgo que la ofrezca. Hace falta que el contenido declare esas elecciones.
