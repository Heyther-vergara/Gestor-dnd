# 0019 — Objetos homebrew

- Fecha: 2026-11-18
- Estado: aceptada

## Contexto

El criterio del MVP pide "al menos un objeto o dote homebrew". Hasta ahora no había nada homebrew: el modelo lo soportaba (paquetes con `source: "homebrew"`, efectos en el contenido) pero no había forma de crearlo ni de usarlo en un personaje.

## Decisión

1. **Un objeto homebrew es contenido normal.** Se arma un `Content` de tipo `item` (categoría `magic`) y se valida con el mismo `contentSchema` que el SRD. El motor no cambia: aplica sus efectos igual que los de una cota de malla. Por eso los tests usan el personaje de ejemplo real (Brunhilda, CA 18 → 19 con un anillo +1).
2. **Un paquete homebrew por navegador** ("Mi homebrew", id `homebrew-<sufijo al azar>`). Los ids de objeto son el nombre en kebab-case + un sufijo al azar, para no chocar con el SRD ("daga") ni entre sí. Si igual chocara, `withHomebrew` deja ganar al SRD.
3. **Qué puede hacer un objeto:** bonificadores `add` (CA, iniciativa, PG máximos, ataque y CD de conjuros, salvaciones, puntuaciones de característica, habilidades) y resistencias al daño (`grant`). "Todas las salvaciones" es un atajo del formulario que se guarda como seis efectos. Se deja afuera la velocidad (se guarda en pies y la hoja muestra metros: un campo en pies confundiría).
4. **Dar el objeto a un personaje** (`giveItem`): activa el paquete homebrew en `activePackageIds` (si no, el motor lo ignora), lo agrega al inventario equipado y, si requiere sintonización, sintonizado. `takeItem` lo saca. Son acciones nuevas del reducer de la hoja, así que se guardan como cualquier cambio del personaje.
5. **Guardado solo en el navegador** (localStorage, sobre con versión y validado con Zod, como ADR 0011). Hoy el usuario es anónimo y por navegador (ADR 0014), así que la nube no permitiría verlo desde otro dispositivo: subirlo sería trabajo sin beneficio todavía. Si lo guardado no se puede leer, la página no deja guardar para no pisarlo.
6. **Formulario sin librerías nuevas:** estado de React, como el creador de personajes. La validación vive en `lib/homebrew.ts` y tiene tests. React Hook Form puede entrar cuando haya formularios más grandes.
7. "Volver al estado inicial" en un personaje creado ahora pone en cero solo el estado de partida y conserva el resto (antes volvía al personaje del momento de abrir la hoja, y se habría llevado un objeto recién dado).

## Consecuencias

- Pantalla `/homebrew` para crear, editar y borrar; sección "Objetos homebrew" en la hoja con "Dar" / "Quitar".
- Si se borra un objeto que un personaje tiene, el personaje deja de recibir el efecto (el motor lo reporta en `issues`) y el inventario muestra su id.
- Si se borran los datos del navegador, se pierde el homebrew (igual que hoy los personajes del usuario anónimo).
- Pendiente: guardar el homebrew en Supabase cuando vuelva el login, dotes y conjuros homebrew, exportar en JSON, límite de tres objetos sintonizados, y que subir de nivel use el índice con homebrew (hoy la vista previa de subir de nivel solo ve el SRD).
