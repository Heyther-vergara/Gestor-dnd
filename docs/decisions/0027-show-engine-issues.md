# 0027 — Mostrar en la hoja los avisos del motor

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

Paso 4 del hardening (ADR 0022), y hallazgo A1 de la auditoría del 18 de noviembre. `calculateSheet` anota en `issues` lo que no pudo aplicar (contenido que no encuentra, elecciones inválidas, límites superados) y sigue calculando sin eso. Ningún componente mostraba esos avisos.

El caso que más pasa: el homebrew vive solo en el navegador donde se importó (ADR 0019 y 0020), pero el personaje se guarda en Supabase. Si abres un personaje con una clase homebrew en otro navegador, el motor no encuentra la clase y la hoja sale sin dados de golpe, salvaciones ni rasgos (0 PG), sin ningún aviso.

Control: SOC 2 PI1.3 (integridad del procesamiento: las salidas son completas y correctas, o se avisa) · ISO 27001 A.8.26.

## Decisión

1. **Un recuadro "Revisa esta hoja" arriba de todo** (`src/components/sheet/sheet-issues.tsx`), con `role="alert"` para que los lectores de pantalla lo anuncien.
2. **Lógica pura en `src/lib/sheet-issues.ts`** que separa los avisos en tres grupos:
   - **Contenido que falta**: se explica con el tipo en español ("clase `tinkerer`") y se dice cómo arreglarlo (importar de nuevo en Homebrew).
   - **Contenido de un paquete no activo.**
   - **Otros avisos**, con el texto del motor tal cual.
     Los avisos repetidos se muestran una vez.
3. **El motor no cambia.** Los dos primeros grupos se reconocen por el texto que escribe `find` en `calculateSheet`; un test con el motor real (clase homebrew presente y ausente) avisa si ese texto cambia.

## Consecuencias

- Ya no hay hojas incorrectas en silencio: si algo falta, se ve antes que cualquier número.
- Los "otros avisos" usan los ids del motor ("La clase "wizard" permite…"). Son raros (datos editados a mano o guardados con versiones viejas), así que no se traducen uno por uno por ahora.
- Pendiente: que el homebrew viaje con el personaje (exportar/importar o guardarlo en la nube), que es lo que evitaría el aviso de raíz.
