# Inventario de activos y proveedores

ISO 27001 A.5.9 (inventario) y A.5.19–A.5.23 (proveedores y servicios en la nube) · SOC 2 CC9.2.

Revisado: 2026-11-26.

## Activos

| Activo            | Dónde vive                                    | Qué contiene                                                                 | Quién tiene acceso                                   | Si se pierde o se compromete                                                                   |
| ----------------- | --------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Código            | GitHub `heyther-vergara/gestor-dnd`           | Toda la app, migraciones, ADRs                                               | Dueño (2FA)                                          | Quien pueda hacer push a `main` controla producción. Mitigado con el ruleset `proteger-main`.  |
| App desplegada    | Vercel, proyecto `gestor-dnd`                 | Despliegues de `main` y vistas previas de cada PR                            | Dueño (2FA)                                          | Se puede volver a un despliegue anterior (Instant Rollback).                                   |
| Base de datos     | Supabase (Postgres)                           | Tabla `characters`: personajes de cada usuario                               | Dueño en el panel; cada usuario solo sus filas (RLS) | Ver "Respaldo" abajo.                                                                          |
| Usuarios          | Supabase Auth                                 | Usuarios anónimos y, si la vinculan, la identidad de Google (email y nombre) | Dueño en el panel                                    | Datos personales: ver riesgo R5.                                                               |
| Datos locales     | Navegador de cada persona (localStorage)      | Copia de sus personajes y **todo** su homebrew                               | Solo esa persona                                     | Si borra los datos del navegador, pierde el homebrew salvo que tenga la copia JSON (ADR 0026). |
| Cuentas del dueño | Email, GitHub, Vercel, Supabase, Google Cloud | Llaves de todo lo anterior                                                   | Dueño (2FA)                                          | El email recupera todas las demás: es la cuenta más importante.                                |

## Proveedores

| Proveedor      | Para qué                         | Qué datos le damos                                                        | Controles que heredamos                                     | Si falla                                                                      |
| -------------- | -------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| GitHub         | Código, CI (Actions), Dependabot | Código (público o privado según el repo)                                  | Cifrado, 2FA, rulesets, reporte privado de fallos           | No se pueden hacer cambios; la app sigue funcionando.                         |
| Vercel         | Hosting y despliegues            | Código compilado, variables `NEXT_PUBLIC_…`                               | HTTPS con HSTS, CDN, protección DDoS básica                 | La app no carga. Los datos siguen en Supabase y en los navegadores.           |
| Supabase       | Base de datos y login            | Personajes, usuarios anónimos, identidades de Google                      | Cifrado en reposo y en tránsito, RLS, límites de peticiones | La app sigue guardando en el navegador y sincroniza cuando vuelve (ADR 0013). |
| Google (OAuth) | "Continuar con Google"           | Nada nuestro; Google le da a Supabase el email y el nombre de quien entra | Login de Google con su propio 2FA                           | No se puede entrar con Google; el usuario anónimo sigue funcionando.          |

## Respaldo

- **Personajes:** cada persona puede descargar una copia JSON (ADR 0026). La base de Supabase tiene los respaldos que incluya el plan del proyecto (plan gratis al 2026-11-26); falta comprobar cuáles y probar una restauración (paso 6 del plan de hardening).
- **Homebrew:** solo en el navegador y en la copia JSON.
- **Código:** en GitHub y en la computadora del dueño.
