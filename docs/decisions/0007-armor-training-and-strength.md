# 0007 — Entrenamiento con armaduras y Fuerza requerida

- Fecha: 2026-10-20
- Estado: aceptada

## Contexto

Hasta ahora un mago con cota de malla recibía la CA completa y podía lanzar conjuros, y la velocidad no bajaba con una armadura pesada sin la Fuerza requerida (pendientes de los ADR 0005 y 0006). Reglas del SRD 5.2.1 (español), capítulo "Equipo":

- "Armaduras", "Fuerza": si la armadura pide una Fuerza, reduce 3 m la velocidad de quien la lleve, salvo que tenga una puntuación igual o superior.
- "Entrenamiento con armaduras", "Armaduras ligeras, medias o pesadas": sin entrenamiento tenés desventaja en cualquier prueba con d20 que implique Fuerza o Destreza y no podés lanzar conjuros.
- "Escudos": solo obtenés el bonificador a la CA si tenés entrenamiento con escudos.
- "Solo un tipo": no se puede llevar más de una armadura ni embrazar más de un escudo a la vez.
- "Convertirse en guerrero", "Como personaje multiclase": como clase secundaria el guerrero da armaduras ligeras y medias y escudos, **no** pesadas. Cada clase tiene su propia lista.

## Decisión

1. **Entrenamiento** = `armorProficiencies` de la clase inicial + `multiclassArmorProficiencies` de las demás clases + concesiones `proficiency.armor.*`. El campo nuevo de la clase se importa de `multi_classing.proficiencies` de 5e-bits (guerrero: ligera, media, escudo; mago: ninguna) y por defecto es `[]`.
2. **Vocabulario cerrado:** `armorProficiencies` deja de ser texto libre y usa `armorTrainingSchema` (`light | medium | heavy | shield`), el mismo de `proficiency.armor.*`.
3. **Escudo sin entrenamiento:** el motor ignora sus efectos. Como el entrenamiento sale de los efectos de los demás contenidos, los del escudo se juntan aparte y se agregan después.
4. **Armadura sin entrenamiento:** la CA se aplica igual. Cada entrada de `spellcasting` lleva `canCast: false`.
5. **Fuerza:** −10 pies a la velocidad de la especie si la Fuerza **final** es menor que `strengthRequirement`. Se resta antes de los efectos `speed` y no baja de 0.
6. **Estado visible, no `issues`:** la hoja expone `armorPenalties { untrainedArmor, untrainedShield, insufficientStrength }`. `issues` queda para datos inválidos; ponerse una armadura sin entrenamiento es legal, solo tiene consecuencias.
7. **Dos armaduras o dos escudos** sí son datos inválidos: van a `issues`. Con dos armaduras se usa la mejor base (ADR 0003); de los escudos se cuenta solo el primero.

## Consecuencias

- La desventaja en pruebas de Fuerza o Destreza no cambia ningún número de la hoja: la interfaz la muestra a partir de `armorPenalties.untrainedArmor`.
- Pendiente: desventaja en Sigilo por armadura (`stealthDisadvantage` ya está en los datos), competencia con armas en multiclase y el resto de las competencias de `multi_classing`.
