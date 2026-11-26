# Seguridad

Gracias por ayudar a que este proyecto sea más seguro.

## Cómo reportar un fallo

**No abras un issue público** con los detalles de un fallo de seguridad: cualquiera podría usarlo antes de que esté arreglado.

Usa el reporte privado de GitHub: pestaña **Security** del repositorio → **Report a vulnerability**. Solo lo ve el dueño del repositorio.

Incluye, si puedes:

- Qué encontraste y dónde (URL, archivo o pantalla).
- Cómo reproducirlo, paso a paso.
- Qué podría hacer alguien con eso (por ejemplo: leer personajes ajenos).

## Qué puedes esperar

Es un proyecto personal mantenido por una sola persona, así que no hay plazos garantizados. La intención es:

- Confirmar que recibimos el reporte en unos días.
- Arreglar primero lo que exponga datos de otras personas.
- Avisarte cuando esté arreglado y darte crédito si quieres.

## Qué entra

- La app desplegada en Vercel y el código de este repositorio.
- La configuración de Supabase que el repositorio describe (tabla `characters`, políticas RLS).

## Qué no entra

- Fallos de Vercel, Supabase, Google o GitHub en sí mismos: repórtalos a cada uno.
- Ataques de denegación de servicio, spam o ingeniería social.
- Contenido homebrew que importas tú mismo en tu navegador: solo te afecta a ti.

Cómo se gestiona la seguridad del proyecto: [`docs/security/`](docs/security/README.md).
