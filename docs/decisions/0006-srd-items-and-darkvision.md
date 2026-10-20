# 0006 — Armaduras, escudo y armas del SRD; visión en la oscuridad como base

- Fecha: 2026-10-20
- Estado: aceptada

## Contexto

- El paquete SRD no tenía objetos, así que no se podía probar la CA con una armadura real.
- La visión en la oscuridad del enano se importaba como `{ op: "max", value: 120 }`. En el motor `max` es un **techo** (PR #4), así que partiendo de 0 el resultado habría sido 0.

Reglas del SRD 5.2.1 (español) que hay que cubrir:

- Tabla "Armaduras": 12 armaduras (3 ligeras, 5 medias, 4 pesadas) y el escudo (+2).
- Tabla "Armas": 38 armas (10 cuerpo a cuerpo sencillas, 4 a distancia sencillas, 18 cuerpo a cuerpo marciales, 6 a distancia marciales), con daño, propiedades y maestría.
- Enano, "Visión en la oscuridad": 36 m (120 pies).
- Anteojos nocturnos: "Si ya posees visión en la oscuridad, estos anteojos aumentan su alcance en 18 m" → el alcance tiene que poder sumarse.

## Decisión

1. **Se importan solo armaduras, escudo y armas** desde `5e-SRD-Equipment.json` de 5e-bits (mismo commit fijo). Equipo de aventurero, herramientas, munición, paquetes y objetos mágicos quedan para cuando el motor o la interfaz los usen.
2. **CA:** cada armadura lleva un único efecto `{ target: "ac", op: "base" }` (ADR 0003): ligeras `abilities: ["dex"]`, medias además `maxAbilityBonus: 2`, pesadas sin Des. El escudo es `{ target: "ac", op: "add", value: 2 }`.
3. **Armas:** nuevo `data.weapon` con `weaponCategory` (simple/martial), `attackType` (melee/ranged), `damage { dice, type }`, `versatileDice`, `properties`, `mastery` y `range` en pies. Una armadura sin `data.armor` o un arma sin `data.weapon` no pasan el esquema. `data.weapon` también se permite en otros objetos (un arma +1 es `magic`).
4. **Correcciones a 5e-bits**, verificadas contra el PDF y escritas en el script (`WEAPON_OVERRIDES`) para que sobrevivan a una reimportación: honda 1d4 **contundente**; tridente **1d8**, versátil (1d10).
5. **Ids únicos:** el escudo y el conjuro _Escudo_ se llaman `shield` en 5e-bits. El objeto pasa a `shield-item` (`ITEM_ID_OVERRIDES`); el test "has unique ids" lo detecta si vuelve a pasar.
6. **Visión en la oscuridad** = `base` + efectos `add`. La hoja expone `darkvision` en pies, 0 si no tiene.

## Consecuencias

- `calculateSheet` todavía **no** comprueba el entrenamiento: según el SRD, el escudo solo suma si tenés entrenamiento con escudos, y una armadura sin entrenamiento da desventaja y no deja lanzar conjuros. Queda pendiente junto con la velocidad reducida por Fuerza insuficiente (ADR 0005).
- Tampoco se impide equipar dos armaduras o dos escudos ("Solo un tipo"); hoy ganaría la mejor base.
- Los ataques con arma (bonificador y daño) se calculan en otra tarea; los datos ya están.
- Los pesos van en libras y los alcances en pies, como el resto del contenido importado.
