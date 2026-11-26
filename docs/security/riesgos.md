# Registro de riesgos

ISO 27001 cláusula 6.1 y A.5.7 · SOC 2 CC3.1–CC3.4.

Escala simple: **Probabilidad** y **Impacto** en Baja / Media / Alta. Revisado: 2026-11-26.

| #   | Riesgo                                                                  | Prob. | Impacto | Controles actuales                                                                    | Qué falta                                                         |
| --- | ----------------------------------------------------------------------- | ----- | ------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| R1  | Alguien entra a una cuenta del dueño (GitHub, Vercel, Supabase, email)  | Baja  | Alta    | 2FA en todas, `main` protegida                                                        | Revisar códigos de recuperación cada año                          |
| R2  | Se sube una clave secreta al repositorio                                | Baja  | Alta    | Solo claves públicas en el código; `.env*` ignorado; revisión en cada PR              | Activar "Secret scanning" de GitHub                               |
| R3  | Una dependencia trae una vulnerabilidad                                 | Media | Media   | `pnpm audit` en CI, Dependabot semanal                                                | —                                                                 |
| R4  | Alguien llena la base con datos basura usando la clave pública          | Media | Media   | Topes de tamaño (ADR 0023), login anónimo solo al guardar, 30 logins anónimos/hora/IP | Tope de filas por usuario; CAPTCHA (requiere cambio en la app)    |
| R5  | Se filtran emails de quienes vincularon Google                          | Baja  | Media   | RLS; la app no lee emails de otros; solo el dueño ve Auth                             | Documentar cómo borrar una cuenta a pedido                        |
| R6  | Un usuario ve o modifica personajes ajenos                              | Baja  | Alta    | RLS por usuario con políticas por operación; `anon` sin permisos                      | Test automático de RLS (paso 8)                                   |
| R7  | XSS: código inyectado en la página                                      | Baja  | Media   | React escapa el texto; sin `dangerouslySetInnerHTML`; CSP (ADR 0024)                  | CSP sin `'unsafe-inline'` (nonces)                                |
| R8  | Un cambio rompe producción                                              | Media | Media   | PR + CI (lint, tipos, tests, build); vistas previas de Vercel                         | Tests de punta a punta (paso 8)                                   |
| R9  | Se pierden datos de la base                                             | Baja  | Alta    | Copia JSON manual (ADR 0026); respaldos del plan de Supabase                          | Confirmar respaldos y probar una restauración (paso 6)            |
| R10 | Una persona pierde su homebrew o sus personajes al limpiar el navegador | Media | Media   | Copia JSON; vincular con Google (ADR 0028)                                            | Homebrew en la nube                                               |
| R11 | La hoja muestra números incorrectos sin avisar                          | Baja  | Baja    | Avisos del motor en la hoja (ADR 0027)                                                | —                                                                 |
| R12 | Alguien configura una conexión directa a Postgres que se salta RLS      | Baja  | Alta    | Hoy no hay conexión directa; `DATABASE_URL` está vacía                                | Decidir si Drizzle sigue en el plan (hallazgo B1 de la auditoría) |

## Riesgos aceptados

- **Un solo responsable:** si el dueño no está, nadie responde a incidentes. Aceptable para un proyecto personal.
- **Plan gratuito de Supabase y Vercel:** límites de uso y respaldos según el plan. Aceptable mientras no haya usuarios que dependan de la app.
