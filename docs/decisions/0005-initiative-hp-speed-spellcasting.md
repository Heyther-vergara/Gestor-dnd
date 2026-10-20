# 0005 — Iniciativa, puntos de golpe, velocidad y conjuros

- Fecha: 2026-10-20
- Estado: aceptada

## Contexto

Tercer tramo de `calculateSheet`. Reglas del SRD 5.2.1 que hay que cubrir:

- "Rellena los números", "Iniciativa": la iniciativa es el modificador por Destreza.
- Dote "Alerta", "Competencia en iniciativa": sumás tu bonificador por competencia a la iniciativa.
- "Puntos de golpe en el nivel 1 por clase": dado de golpe entero + Con (bárbaro 12, guerrero 10, mago 6…).
- "Subir de nivel", paso 2: en cada nivel siguiente, tirás el dado o usás el valor establecido (d12 → 7, d10 → 6, d8 → 5, d6 → 4), + Con, **mínimo 1**.
- "Ajustar los modificadores por característica": si sube el modificador por Con, los PG máximos suben 1 por cada nivel.
- "Multiclase", "Puntos de golpe y dados de golpe": solo obtenés los PG del nivel 1 de una clase cuando tu nivel total es 1. Los dados de golpe de distintos tipos se cuentan por separado.
- "Rellena los números", "Lanzamiento de conjuros": CD = 8 + aptitud mágica + competencia; ataque = aptitud mágica + competencia.
- "Multiclase", "Lanzamiento de conjuros": cada conjuro usa la aptitud mágica de su clase.

## Decisión

1. **Iniciativa:** mod. de Des + competencia si hay una concesión `proficiency.initiative` + efectos `initiative`. _Alerta_ es una concesión y no `{ target: "initiative", op: "add", value: 2 }` porque el número tiene que subir solo con el nivel.
2. **PG máximos:** la clase inicial (la primera de `classes`) da el dado entero + Con; todos los demás niveles dan el valor establecido + Con, con mínimo 1 por nivel. Después se suman los efectos `hp.max-per-level` × nivel total y se aplican los efectos `hp.max`. Siempre se usa Con **final**, así que subir Con recalcula todos los niveles.
3. **Valor establecido, no tirada:** tirar el dado sería una elección más por nivel para guardar en el personaje. Se agrega cuando haya pantalla de subir de nivel.
4. **PG actuales** = máximo − `damageTaken`, sin bajar de 0. Los temporales se muestran tal cual.
5. **Dados de golpe:** por tipo (`{ d10: 2, d6: 1 }`), total y restantes (total − `hitDiceSpent`). `playState` guarda un solo número de gastados, así que todavía no se sabe de qué tipo fueron.
6. **Velocidad:** la de la especie + efectos `speed`, en pies como el contenido importado. La interfaz convierte a metros (30 pies = 9 m).
7. **Conjuros:** una entrada por clase con `spellcasting`, en el orden de `classes`. Los efectos `spell.dc` / `spell.attack` se aplican a todas.

## Consecuencias

- La hoja expone `initiative`, `hitPoints { max, current, temp }`, `hitDice { byDie, total, remaining }`, `speed` y `spellcasting[]`.
- `hp.max-per-level` usa el nivel **total**. Sirve para _Aguante enano_; un rasgo que escala con el nivel de **una** clase (p. ej. _Resistencia dracónica_ del hechicero) necesitará otro target.
- Pendiente: tirar PG, velocidad reducida por armadura pesada sin la Fuerza requerida, dados de golpe gastados por tipo y lanzamiento de conjuros de subclases (Caballero arcano), que hoy no tienen `spellcasting` en el esquema.
