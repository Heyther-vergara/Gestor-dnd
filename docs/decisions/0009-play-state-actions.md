# 0009 — Daño, curación y descansos en partida

- Fecha: 2026-10-21
- Estado: aceptada (salvaciones contra muerte: ADR 0010; resistencias, PG máximos y cansancio: ADR 0012)

## Contexto

La hoja de ejemplo era de solo lectura. Para usarla en la mesa hay que poder recibir daño, curarse, ganar PG temporales y descansar. Reglas del SRD 5.2.1 (español):

- "Puntos de golpe temporales": se pierden primero y el daño sobrante va a los PG normales. No se suman: si recibís más, elegís con cuáles te quedás. No se recuperan con curación. Duran hasta que se consumen o hasta que finalizás un descanso largo.
- "Puntos de golpe": no bajan de 0. "Curación": no superan los PG máximos; lo que sobra se pierde.
- "Daño considerable": si el daño te deja en 0 y lo que sobra es mayor o igual a tus PG máximos, morís.
- "Daño con 0 puntos de golpe": cuenta como un fallo de salvación contra muerte (dos si es crítico); si es mayor o igual a tus PG máximos, morís.
- "Descanso corto": para empezarlo necesitás al menos 1 PG. Por cada dado de golpe que gastás, lo tirás + mod. de Con y recuperás ese total, mínimo 1. Decidís si gastás otro después de cada tirada.
- "Descanso largo": para empezarlo necesitás al menos 1 PG. Recuperás todos los PG y **todos** los dados de golpe gastados.
- "Multiclase": los dados de golpe de distinto tipo se cuentan por separado.

## Decisión

1. **Acciones puras en el motor** (`engine/play-state.ts`): `applyDamage`, `heal`, `gainTempHp`, `spendHitDie` y `longRest`. Reciben el personaje (y el contenido cuando necesitan los PG máximos) y devuelven `{ ok: true, playState, … }` o `{ ok: false, reason }`. No modifican el personaje original.
2. **El motor no tira dados.** El jugador tira en la mesa y carga el resultado. Así el motor sigue siendo determinista y los tests no dependen del azar.
3. **Se sigue guardando el daño recibido**, no los PG actuales (ADR 0005). Cada acción calcula los PG actuales nuevos y guarda `damageTaken = máximo − actuales`, lo que además corrige un daño guardado mayor que el máximo.
4. **`hitDiceSpent` pasa a ser por tipo** (`{ d10: 1 }`), y la hoja expone `hitDice.byDie[die] = { total, remaining }`. Sin base de datos todavía, el cambio de esquema no requiere migración.
5. **No hay función de "descanso corto"**: su único efecto modelado es gastar dados, uno por vez. Cuando haya rasgos que se recargan con descanso corto se agrega.
6. **PG temporales: se conserva el mayor.** La regla deja elegir, pero quedarse con menos casi nunca conviene. Si algún rasgo lo necesita, se agrega la opción.
7. **El daño informa qué pasó** (`unharmed`, `hurt`, `dropped-to-zero`, `damaged-at-zero`, `instant-death`) para que la interfaz avise. Las salvaciones contra muerte todavía no se guardan.
8. **Interfaz**: `PlayableSheet` es un Client Component con `useReducer`. El reducer (`lib/play-reducer.ts`) traduce cada botón a una acción del motor y arma el mensaje. No se agrega Zustand: con una sola hoja alcanza con React. El contenido SRD (~70 KB de JSON) viaja al navegador para recalcular la hoja.

## Consecuencias

- Recargar la página vuelve al personaje inicial hasta que haya base de datos.
- Pendiente: que el daño interrumpa un descanso. (Resistencias y vulnerabilidades, PG máximos reducidos y cansancio: ADR 0012.)
