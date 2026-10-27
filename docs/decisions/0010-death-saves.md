# 0010 — Salvaciones contra muerte

- Fecha: 2026-10-27
- Estado: aceptada

## Contexto

El ADR 0009 dejó pendientes las salvaciones contra muerte: el daño avisaba "caíste a 0 PG" o "daño considerable", pero no se guardaba nada. Reglas del SRD 5.2.1 (español), capítulo "Daño y curación":

- "Caer inconsciente": con 0 PG, sin morir al instante, quedás inconsciente hasta recuperar cualquier cantidad de PG y hacés salvaciones contra muerte.
- "Tiradas de salvación contra muerte": al empezar tu turno con 0 PG tirás 1d20. Con 10 o más es éxito; si no, fallo. Con el tercer éxito te estabilizás; con el tercer fallo morís. No tienen que ser consecutivos. La cuenta vuelve a cero si recuperás PG o te estabilizás.
- "Sacar 1 o 20": un 1 cuenta como dos fallos. **Un 20 te devuelve 1 PG** (en la edición 2014 eran "dos éxitos"; acá se sigue el SRD 5.2.1).
- "Daño con 0 puntos de golpe": cuenta como un fallo; si es de un crítico, dos. Si es mayor o igual a tus PG máximos, morís.
- "Estabilizar a un personaje": otro usa la acción de ayudar y supera Sabiduría (Medicina) CD 10. Estable no tira salvaciones, pero sigue inconsciente con 0 PG. Si recibe daño deja de estar estable. Si nadie lo cura, recupera 1 PG tras 1d4 horas.

## Decisión

1. **`playState` guarda `deathSaves: { successes, failures }`, `stable` y `dead`.** Con valores por defecto, así los personajes guardados antes siguen siendo válidos. La cuenta va de 0 a 3.
2. **`dead` se guarda** porque no se deduce de los PG: con 0 PG podés estar agonizando, estable o muerto. Es estado de partida, no un valor derivado.
3. **La hoja expone `deathSaves.status`** (`conscious`, `dying`, `stable`, `dead`), que sí se deduce: muerto manda; si no, con PG estás consciente; con 0, estable o agonizando.
4. **Funciones nuevas en el motor**: `rollDeathSave(character, contentIndex, roll)` y `stabilize(character, contentIndex)`. Como con los dados de golpe, **el jugador tira el d20 en la mesa y carga el resultado**; el motor sigue siendo determinista. `stabilize` registra que la prueba de Medicina salió bien; no la tira.
5. **`applyDamage` recibe `{ critical }`** y suma uno o dos fallos con 0 PG. Si es el tercero, el resultado es `death-from-failures`. Daño a un estable le quita la estabilidad.
6. **Los PG temporales evitan el fallo.** Si con 0 PG los temporales absorben todo el daño, no se suma un fallo: la regla dice que evitan "la pérdida de puntos de golpe reales", y el resultado ya era `unharmed`.
7. **Curar resetea**: cualquier curación que te deje con más de 0 PG pone la cuenta en cero y quita `stable`.
8. **Un personaje muerto no admite acciones** (daño, curación, PG temporales, descansos, salvaciones): todas devuelven "El personaje está muerto". Revivir requiere magia (por ejemplo, _alzar a los muertos_), que no está modelada. En la hoja de ejemplo, "Volver al estado inicial" lo revive.
9. **Interfaz**: un bloque `DeathSaves` aparece solo con 0 PG o muerto, con tres casillas de éxito (verde, token `success`) y tres de fallo (`destructive`), el campo del d20, "Tirar salvación" y "Estabilizar". El daño tiene una casilla "golpe crítico". Las casillas solo muestran; se cambian con las acciones, para no saltear las reglas.

## Consecuencias

- Pendiente: recuperar 1 PG tras 1d4 horas estando estable (hoy se hace con "Curar 1"), el estado inconsciente como condición formal (cuando se modelen condiciones), revivir con conjuros, y rasgos que cambian estas reglas.
- El ADR 0009 queda completo en lo que dejó pendiente sobre salvaciones contra muerte.
