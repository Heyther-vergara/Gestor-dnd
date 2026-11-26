# Seguridad del Gestor-DnD

Proyecto personal guiado por SOC 2 e ISO/IEC 27001:2022 **sin certificar** (ADR 0022): los marcos sirven como lista de preguntas, y cada control deja evidencia.

## Política mínima

1. **Acceso:** solo el dueño tiene acceso a GitHub, Vercel, Supabase y Google Cloud, todos con 2FA. `main` está protegida: todo cambio entra por PR con CI en verde.
2. **Secretos:** ninguna clave secreta va en el repositorio. Al navegador solo llegan valores públicos (`NEXT_PUBLIC_…`). Los secretos (clave secreta de Supabase, secreto del cliente de Google) viven solo en los paneles de cada servicio.
3. **Datos:** se guarda lo mínimo. Los personajes son de quien los creó (RLS). No se guardan datos personales salvo la identidad de Google de quien elige vincularla (ADR 0028).
4. **Cambios:** cada decisión importante tiene un ADR en `docs/decisions/`. CI corre lint, tipos, tests, build y `pnpm audit`. Dependabot propone actualizaciones cada semana.
5. **Incidentes:** se siguen los pasos de [`incidentes.md`](incidentes.md).
6. **Revisión:** estos documentos se revisan cada 3 meses, o antes si cambia la arquitectura (nuevo servicio, nuevo tipo de dato).

## Documentos

| Documento                                | Para qué                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| [`inventario.md`](inventario.md)         | Qué activos y proveedores hay, qué datos tiene cada uno y qué pasa si falla. |
| [`riesgos.md`](riesgos.md)               | Qué puede salir mal, qué tan probable y grave es, y qué control lo mitiga.   |
| [`incidentes.md`](incidentes.md)         | Qué hacer, paso a paso, si algo sale mal.                                    |
| [`../../SECURITY.md`](../../SECURITY.md) | Cómo reportar un fallo de forma privada.                                     |

## Controles y dónde está la evidencia

| Control (SOC 2 · ISO 27001)                | Qué se hizo                                                                                                               | Evidencia                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| CC6.1 · A.5.17, A.8.5                      | 2FA en las cuentas                                                                                                        | Capturas del dueño (fuera del repo)                                                |
| CC6.1, CC8.1 · A.8.32                      | `main` protegida (PR + CI, sin force push ni borrado)                                                                     | Capturas del ruleset `proteger-main`                                               |
| CC6.1 · A.5.15, A.8.3                      | RLS por usuario en `characters`                                                                                           | `supabase/migrations/20261101000000_characters.sql`                                |
| CC7.1, CC8.1 · A.8.8, A.8.25               | CI con build y `pnpm audit`; Dependabot; token de CI de solo lectura                                                      | `.github/`, ADR 0022                                                               |
| CC6.6 · A.8.6, A.8.26                      | Topes de tamaño en esquemas, archivos y base; login anónimo solo al guardar; límite de 30 logins anónimos por hora por IP | ADR 0023, migración `20261125000000_characters_size_limits.sql`, captura del panel |
| CC6.6 · A.8.26                             | Cabeceras de seguridad (CSP, frame-ancestors, nosniff…)                                                                   | ADR 0024, `src/lib/security-headers.ts`                                            |
| PI1.3 · A.8.26                             | La hoja avisa cuando falta contenido                                                                                      | ADR 0027                                                                           |
| A1.2 · A.8.13                              | Copia de seguridad en JSON                                                                                                | ADR 0026                                                                           |
| CC3, CC7.3–7.5, CC9.2 · A.5.9, A.5.19–5.26 | Inventario, riesgos, incidentes y reporte privado                                                                         | Esta carpeta y `SECURITY.md`                                                       |
