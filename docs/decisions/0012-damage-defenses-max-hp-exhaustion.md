# 0012 — Resistencias, PG máximos reducidos y cansancio

- Fecha: 2026-10-30
- Estado: aceptada

## Contexto

El ADR 0009 dejó pendientes tres reglas de daño. Reglas del SRD 5.2.1 (español):

- "Resistencia y vulnerabilidad": con resistencia, el daño de ese tipo se reduce a la mitad (redondeando hacia abajo); con vulnerabilidad, se duplica. "No se acumulan": varias resistencias al mismo tipo cuentan como una. "Orden de aplicación": primero los ajustes (bonificadores, penalizadores, multiplicadores), después las resistencias y por último las vulnerabilidades.
- "Inmunidad": no recibís daño de ese tipo.
- "Puntos de golpe máximos de 0": una criatura muere si sus PG máximos llegan a 0. Ciertos efectos absorben la energía vital y los reducen. "Descanso largo", "Puntos de golpe al máximo": si tus PG máximos se habían reducido, vuelven a la normalidad. _Restablecimiento mayor_ también quita la reducción.
- "Cansancio [estado]": es acumulativo, de a un nivel. Con nivel 6 morís. Cada nivel resta 2 al resultado de las pruebas con d20 (pruebas de característica, tiradas de ataque y de salvación) y 1,5 m a la velocidad. El descanso largo resta 1 nivel.

## Decisión

1. **Los 13 tipos de daño van en `schemas/common.ts`** (antes estaban solo en las armas). Las defensas son **efectos `grant`**: `resistance.<tipo>`, `vulnerability.<tipo>` e `immunity.<tipo>`, con el vocabulario cerrado del ADR 0003. El enano ("Resistencia enana") ahora tiene `resistance.poison`.
2. **La hoja expone `damageDefenses`** (`resistances`, `vulnerabilities`, `immunities`). Como se arma con un conjunto, "No se acumulan" sale sola.
3. **`applyDamage` recibe `{ damageType }` opcional.** Sin tipo, el daño se aplica tal cual. Con tipo: inmunidad → 0; si no, resistencia (÷2 hacia abajo) y después vulnerabilidad (×2). Los ajustes los suma el jugador antes de cargar el número. El resultado informa `damage` (el final) y `defenses` (las que se aplicaron), y los PG temporales, el daño considerable y los fallos con 0 PG usan el daño final. Si una inmunidad deja el daño en 0, no hay fallo de salvación contra muerte.
4. **`playState.maxHpReduction`** guarda cuánto se redujo el máximo. Es estado de partida (lo causa un efecto), no un valor derivado. La hoja devuelve `hitPoints.max` ya reducido y `hitPoints.maxReduction`. `reduceMaxHp` baja los PG actuales solo si quedan por encima del máximo nuevo ("Curación": no pueden superarlo); con máximo 0, el personaje muere. `restoreMaxHp` (_Restablecimiento mayor_) quita la reducción sin curar. El descanso largo la pone en 0.
5. **`playState.exhaustion`** va de 0 a 6. `gainExhaustion` suma 1 (con 6, `dead: true`); `removeExhaustion` resta 1 (_Restablecimiento mayor_ y rasgos parecidos); el descanso largo resta 1.
6. **El cansancio ya viene restado en los números de la hoja**: salvaciones, habilidades, iniciativa y ataque de conjuros. La hoja también expone `exhaustion` (`level`, `d20Penalty`, `speedPenalty`) para mostrar el aviso. No cambia los modificadores de característica (sirven también para el daño), ni la CD de conjuros (la tira el objetivo).
7. **La Percepción pasiva no baja con el cansancio.** El SRD la define como 10 + el bonificador a las pruebas de Sabiduría (Percepción), y el cansancio reduce "el resultado" de una prueba con d20, que la pasiva no tiene. Es una lectura del texto: si en la mesa se juega distinto, se cambia en un lugar.
8. **Datos guardados**: los campos nuevos tienen valor por defecto (0), así que lo guardado en el navegador (ADR 0011) se sigue cargando sin migración ni cambio de versión.
9. **Interfaz**: un selector "Tipo de daño" (en orden alfabético en español) junto al botón Daño; "Reducir PG máx." usa el mismo campo de cantidad y "Restablecer máx." aparece si hay reducción; el cansancio tiene botones −1 y +1. La hoja muestra las defensas, el máximo reducido y un aviso con las penalizaciones del cansancio.

## Consecuencias

- El ADR 0009 queda completo, salvo que el daño interrumpa un descanso.
- Pendiente: defensas que dependen de un estado (la furia del bárbaro da resistencia mientras está enfurecido), defensas elegidas (linaje dracónico), "resistencia a todo el daño", reducir el daño en una cantidad fija (_Resistencia de la piedra_), y rasgos que quitan cansancio con el descanso corto. Cuando se modelen condiciones, el cansancio puede pasar a ser una más.
