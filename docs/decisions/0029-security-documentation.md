# 0029 — Documentos de seguridad

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

Paso 5 del hardening (ADR 0022). Hasta ahora los controles existían en el código y en los paneles (CI, límites, cabeceras, 2FA, ruleset), pero no había un lugar que dijera qué protegemos, contra qué, quién lo cuida y qué hacer si algo sale mal. SOC 2 e ISO 27001 piden justamente eso: que los controles estén escritos y se puedan revisar.

Controles: SOC 2 CC3.2 (riesgos), CC7.3–CC7.5 (incidentes), CC9.2 (proveedores) · ISO 27001 A.5.9 (inventario), A.5.19–A.5.23 (proveedores), A.5.24–A.5.27 (incidentes), A.5.7/A.8.8 (reporte de vulnerabilidades).

## Decisión

1. **`SECURITY.md`** en la raíz: cómo reportar una vulnerabilidad en privado (GitHub → Security → Report a vulnerability) y qué entra en el alcance. GitHub lo muestra en la pestaña Security.
2. **`docs/security/`** con cuatro archivos cortos, en español:
   - `README.md`: política en una página, índice y tabla control → evidencia.
   - `inventario.md`: activos (código, base, cuentas, claves) y proveedores (GitHub, Vercel, Supabase, Google).
   - `riesgos.md`: registro de riesgos R1–R12 con probabilidad, impacto, control y riesgos aceptados.
   - `incidentes.md`: runbook paso a paso para los incidentes más probables (clave filtrada, cuenta comprometida, abuso de la base, deploy roto, dependencia vulnerable, reporte recibido).
3. **Sin secretos ni capturas en git.** La evidencia (capturas) queda fuera del repo; los documentos solo la nombran.
4. **Drizzle / `DATABASE_URL` no se toca en este paso.** Queda como riesgo R12 hasta que el dueño decida si se usa.

## Consecuencias

- Revisar `riesgos.md` e `inventario.md` cuando se agregue un proveedor, un tipo de dato o una forma de login.
- Revisión completa una vez al año (o tras un incidente), anotando la fecha en `docs/security/README.md`.
- El reporte privado de vulnerabilidades y el secret scanning se activan en la configuración del repo; no se pueden activar desde el código.
