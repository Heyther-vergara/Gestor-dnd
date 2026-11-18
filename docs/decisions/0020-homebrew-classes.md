# 0020 — Clases homebrew importadas desde JSON

- Fecha: 2026-11-18
- Estado: aceptada

## Contexto

El usuario quiere jugar una clase homebrew de terceros (el Alquimista de DM Clockwork Dragon, traducido por Hagmid & Gadhim). No es SRD y no tiene una licencia abierta: no podemos publicar su texto en el repositorio, que es público. Además, la clase usa cosas que el modelo no tenía: un recurso con usos contados ("Puntos de Catalizador" con "Límite de acción"), una CD propia ("CD de Brebaje") y competencias con herramientas.

## Decisión

1. **Importar en vez de incluir.** La app aprende a importar una clase homebrew desde un archivo JSON (formato `gestor-dnd/homebrew-class`, versión 1: `class` + `subclasses`). El archivo queda en la compu del usuario y la clase se guarda en el paquete homebrew del navegador, junto a los objetos (ADR 0019). El repositorio solo tiene una clase inventada para los tests ("Inventor").
2. **Una clase homebrew es contenido normal.** Se valida con el mismo `contentSchema`, se le pone el id del paquete homebrew y el motor la trata igual que al guerrero. Un id que ya usa el SRD u otro homebrew se rechaza; volver a importar la misma clase la actualiza con sus subclases.
3. **Tres campos nuevos en los datos de clase**, todos con valor por defecto para no romper el SRD:
   - `toolProficiencies`: texto. La hoja muestra la herramienta del trasfondo y las de la clase inicial.
   - `resources`: recursos con usos (`maxByLevel`, `perUseLimitByLevel` opcional, se recuperan con descanso largo). Son genéricos: después pueden servir para "Tomar aliento" del guerrero.
   - `saveDcs`: CD de clase = 8 + competencia + modificador, como la de conjuros del SRD 5.2.1.
4. **El personaje guarda lo gastado** (`playState.resourcesSpent`), no lo que queda, como con los dados de golpe: si el máximo sube al subir de nivel, lo que queda se recalcula solo. La acción `spendResource` no deja gastar más de lo que queda ni más que el límite por uso; el descanso largo lo pone en cero.
5. **El creador, la lista, subir de nivel y la hoja usan el índice con homebrew.** Al crear un personaje se activan los paquetes de lo elegido (si no, el motor ignora la clase).

## Consecuencias

- `/homebrew` tiene "Clases importadas" (importar y borrar). La hoja muestra "Recursos de clase" con un contador para gastar, y las herramientas.
- Si se borra una clase que usa un personaje, su hoja no se puede calcular bien hasta volver a importarla.
- Pendiente: elegir rasgos de una lista (los Descubrimientos del Alquimista se muestran como texto), duplicar la competencia en una habilidad con otra característica, recursos que se recuperan con descanso corto, exportar el homebrew y guardarlo en la nube.
