# 0028 — Marcar espacios de conjuro gastados

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

La hoja mostraba cuántos espacios de conjuro tiene la clase (ADR 0021, ADR 0025), pero no se podían gastar. En partida, el jugador tenía que llevar la cuenta aparte.

## Decisión

- `playState.spellSlotsSpent`: lo gastado por clase y por nivel de conjuro (`{ wizard: [3, 1] }`). Se guarda lo gastado y no lo que queda, como los dados de golpe y los recursos de clase: si los espacios suben con el nivel, lo que queda se recalcula solo. Por defecto `{}`, así los personajes ya guardados siguen siendo válidos.
- El motor agrega `slotsRemaining` a cada clase lanzadora (nunca negativo).
- Acciones puras `spendSpellSlot` y `recoverSpellSlot`. Recuperar sirve para corregir un toque equivocado; no modela Recuperación arcana.
- SRD 5.2.1, mago, "Espacios de conjuro": "recuperas todos los espacios gastados cuando finalizas un descanso largo". `longRest` los pone en cero.
- En la hoja, cada espacio es un círculo-botón de 24 px: lleno se gasta, vacío se recupera. El resumen del libro cerrado muestra lo que queda ("Espacios 2/4 1/2").
- Por clase, no en una tabla común: la tabla de multiclase sigue pendiente (ADR 0016).

## Fuera de alcance

- Qué conjuro se lanzó (el jugador elige el espacio, también de nivel más alto).
- Recuperación arcana del mago (descanso corto).
