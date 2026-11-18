# 0021 — Conjuros del mago: trucos, libro y preparados

- Fecha: 2026-11-18
- Estado: aceptada

## Contexto

El MVP pide "lista de conjuros y preparados". El mago ya tenía CD, ataque y espacios (ADR 0016), pero no podía elegir conjuros, y el paquete solo traía 20 (trucos y nivel 1). Un mago de nivel 3 a 5 no tenía conjuros de nivel 2 y 3 para aprender.

Reglas (SRD 5.2.1, mago, "Lanzamiento de conjuros" y tabla "Rasgos de mago"):

- **Trucos:** 3 (4 desde el nivel 4). Al terminar un descanso largo se puede cambiar uno.
- **Libro de conjuros:** empieza con 6 de nivel 1 y suma 2 por cada nivel después del 1, siempre de niveles con espacios.
- **Preparados:** columna "Conjuros preparados" de la tabla (4, 5, 6, 7, 9 en los niveles 1 a 5), elegidos del libro y de niveles con espacios. Se cambian al terminar un descanso largo. En el SRD 2024 ya **no** es Int + nivel (eso era 2014).

## Decisión

1. **Contenido:** el script importa todos los conjuros de la lista de mago hasta nivel 3 (110), el nivel más alto con espacios de un mago de nivel 5. La clase trae tres datos nuevos en `spellcasting`: `cantripsByLevel` y `preparedByLevel` (columnas de la tabla, de 5e-bits) y `spellbook: { initial, perLevel }` (sale del texto del rasgo). Todos opcionales o con valor por defecto, así una clase homebrew puede tener su tabla, y una sin libro prepara de su lista entera (como el clérigo).
2. **Personaje:** cada entrada de `classes` puede tener `cantripIds`, `spellbookIds` y `preparedSpellIds`. Son **listas actuales**, no un historial, porque trucos y preparados cambian con los descansos. Son opcionales: un guerrero, o un mago guardado antes, no las tiene.
3. **Motor:** `spellLimits(clase, nivel)` dice cuántos de cada uno y el nivel de conjuro más alto. `calculateSheet` devuelve en `spellcasting[]` los límites y las tres listas ya validadas; lo inválido (otra lista, nivel sin espacios, preparado fuera del libro, repetido, de más) se ignora o se avisa en `issues`, como el resto de la hoja.
4. **Dónde se elige cada cosa:**
   - **Creador:** paso "Conjuros" (solo si la clase tiene trucos o libro): 3 trucos y 6 conjuros para el libro.
   - **Subir de nivel:** los trucos y conjuros del libro que faltan para el máximo del nivel nuevo. Normalmente es la diferencia (2 al libro, +1 truco en el nivel 4); un mago creado antes de esto completa sus listas.
   - **Hoja:** "Preparar conjuros", "Cambiar trucos" y "Anotar en el libro", porque preparar es algo de todos los días, no de crear o subir. No se controla que sea después de un descanso largo: la hoja confía en el jugador, como en el resto de la partida.
5. **Lógica pura en `lib/spells.ts`** (opciones de cada lista y `toggleSpell`), usada por la hoja, el creador y subir de nivel.

## Consecuencias

- La hoja muestra trucos, preparados y libro, con tiempo de lanzamiento, alcance, componentes, duración y texto de cada conjuro.
- Los nombres y textos de los conjuros están en inglés, como los rasgos. Traducir los nombres pide el texto del SRD en español, que no está en el repositorio.
- Quedan afuera: los conjuros gratis del Evocador ("Erudito de evocación"), "Memorizar conjuro" (nivel 5), marcar espacios gastados, lanzar rituales sin preparar ("Adepto a los rituales", se ve en el rasgo y con la etiqueta "Ritual"), copiar conjuros encontrados al libro y conjuros homebrew.
