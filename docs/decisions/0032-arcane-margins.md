# 0032 — Círculo de invocación en los márgenes

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

En pantallas anchas el contenido ocupa 72rem en el centro y los lados quedan vacíos. Se probaron tres direcciones en maquetas (círculo de invocación, constelaciones, runas en columna) y se eligió el **círculo de invocación**.

## Decisión

- Un círculo de invocación en SVG a cada lado: anillos, una estrella de 7 puntas, marcas de reloj y sigilos. Es dibujo propio generado con código, sin arte oficial ni de terceros.
- Lo genera `src/lib/arcane-circle.ts` con un generador pseudoaleatorio con semilla: el mismo dibujo en el servidor y en el cliente, así no hay diferencias al hidratar. Tiene tests.
- `ArcaneMargins` es un Server Component: no manda JavaScript al navegador, solo SVG.
- Solo se muestra desde 1440 px de ancho y cada lado se recorta al hueco del margen, así nunca tapa el contenido. En celular y tablet no existe.
- Es decoración: `aria-hidden`, sin eventos de puntero, detrás del contenido (`-z-10`) y con opacidad baja (25 % en claro, 20 % en oscuro). Usa `currentColor` con el token dorado, así sigue el tema.
- Gira muy lento (una vuelta cada 4 minutos) solo con `motion-safe`: quien pidió reducir el movimiento en su sistema lo ve quieto.

## Consecuencias

- Peso mínimo: dos SVG de unos pocos KB, sin imágenes ni dependencias.
- Si el ancho máximo del contenido cambia, hay que ajustar el recorte (`72rem`) en `arcane-margins.tsx`.
