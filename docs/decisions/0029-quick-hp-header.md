# 0029 — Daño y curación rápidos en la cabecera

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

Con la cabecera fija (ADR 0025), los PG siempre están a la vista, pero para cambiarlos había que volver arriba al panel de partida. En combate es lo que más se toca.

## Decisión

- Un botón "±" en la cabecera fija abre una fila con la cantidad y los botones **Daño** y **Curar**. Mandan las mismas acciones del reducer que el panel de partida (`damage` y `heal`): las reglas siguen en el motor.
- La fila muestra el mensaje del motor ("Perdiste 7 PG.") en una región `role="status"`, así el lector de pantalla lo anuncia.
- Tipo de daño, crítico, PG temporales, descansos y cansancio siguen solo en el panel de partida: la cabecera tiene que seguir siendo chica en un celular de 390 px.
- La hoja de solo lectura no recibe el botón (`quickHp` es opcional).
