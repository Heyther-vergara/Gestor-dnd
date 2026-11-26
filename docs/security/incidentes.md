# Qué hacer si algo sale mal

ISO 27001 A.5.24–A.5.27 · SOC 2 CC7.3–CC7.5.

En un incidente no se piensa bien. Esta lista se escribió antes para no tener que improvisar.

## Pasos generales

1. **Contener:** que el daño no siga (rotar la clave, pausar, volver a una versión anterior).
2. **Entender:** qué pasó, desde cuándo y a quién afecta. Anota la hora de cada cosa que hagas.
3. **Arreglar:** el problema de fondo, con un PR como cualquier cambio.
4. **Avisar:** si se expusieron datos de otras personas, avísales qué pasó y qué hiciste.
5. **Aprender:** escribe un resumen corto (qué pasó, por qué, qué cambiaste) y actualiza [`riesgos.md`](riesgos.md).

## Casos

### Se filtró la clave secreta de Supabase (`sb_secret_…` o `service_role`)

Esta clave se salta RLS: con ella se puede leer y borrar **todo**.

1. Supabase → Project Settings → **API Keys** → crea una clave secreta nueva y **borra** la filtrada.
2. Si el filtrado fue en GitHub, borrar el commit no alcanza: la clave ya es pública. Rotarla es lo que importa.
3. Revisa en Supabase → **Logs** si hubo accesos raros desde que se filtró.

### Se filtró la clave publicable (`sb_publishable_…`)

Es pública a propósito: no es un incidente. RLS protege los datos. Si hay abuso con ella, ver "Abuso de la base".

### Alguien entró a una cuenta del dueño

1. Desde otro dispositivo: cambia la contraseña, cierra todas las sesiones y revisa que el 2FA siga activo.
2. **GitHub:** revisa los commits y PRs recientes, las claves SSH, los tokens y las apps autorizadas.
3. **Vercel:** revisa los despliegues recientes y las variables de entorno.
4. **Supabase:** revisa miembros del equipo, claves y cambios en las tablas.
5. Si cambiaron algo en producción, vuelve a la versión buena (ver "Un despliegue rompió la app").

### Abuso de la base (alguien la llena de basura)

1. Supabase → Authentication → **Rate Limits**: baja el límite de logins anónimos.
2. Si sigue: Supabase → Project Settings → General → **Pause project**. La app sigue guardando en los navegadores.
3. Borra las filas basura por SQL, mirando antes cuáles son.

### Un despliegue rompió la app

1. Vercel → proyecto → **Deployments** → elige el último que funcionaba → **Instant Rollback** (o "Promote to Production").
2. Arregla el problema en un PR nuevo; no reviertas a mano en `main`.

### Una dependencia tiene una vulnerabilidad grave

1. CI va a fallar en `pnpm audit`, o Dependabot abre un PR.
2. Si hay versión arreglada: mergea el PR de Dependabot (o súbela a mano).
3. Si no la hay: mira si la app usa la parte afectada. Si no, documéntalo en el PR y espera la versión; nunca apagues el chequeo.

### Alguien reporta un fallo (`SECURITY.md`)

1. Confirma que lo recibiste.
2. Reprodúcelo. Si expone datos de otras personas, es la prioridad.
3. Arréglalo en un PR y avísale a quien lo reportó.
