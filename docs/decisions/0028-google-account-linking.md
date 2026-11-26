# 0028 — Vincular los personajes a una cuenta de Google

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

Con el usuario anónimo (ADR 0013) los personajes quedan atados a un navegador. El ADR 0026 agregó una copia de seguridad en JSON, pero es manual. Heyther pidió también una cuenta, y eligió **Google**: es la cuenta que más jugadores ya tienen, y a diferencia del login por email (ADR 0014, en pausa) no necesita SMTP propio ni editar plantillas de email.

## Decisión

1. **Vincular, no crear otro usuario.** Si el navegador tiene un usuario anónimo, "Continuar con Google" llama a `linkIdentity({ provider: "google" })`: Supabase le agrega la identidad de Google **al mismo usuario** (mismo id). Las filas de `characters` ya son suyas, así que no se copia nada. Requiere activar "Allow manual linking" en Supabase.
2. **Sin sesión, se entra directo** con `signInWithOAuth`, sin crear un anónimo de más (ADR 0023).
3. **Si esa cuenta de Google ya era de otro usuario** (por ejemplo, la vinculaste en otro dispositivo), Supabase vuelve con `error_code=identity_already_exists`. La app lo lee de la URL, avisa y ofrece "Entrar a esa cuenta". Al entrar, los personajes de este navegador que la cuenta no tiene (o tiene más viejos) se **suben a la cuenta** (`uploadLocalCharacters`): gana la copia más nueva, como en el ADR 0013. El usuario anónimo anterior queda huérfano en la base, como en el ADR 0014.
4. **Al salir** se suben primero los personajes del navegador y después se borran sus copias locales (puede ser una computadora compartida, ADR 0014). Si la subida falla, no se sale. El homebrew no se borra porque todavía no está en la nube.
5. **Detrás de una variable**: el botón solo aparece con `NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED=true`, para no mostrarlo hasta que Google esté configurado en Supabase y en Google Cloud.
6. Va en "Mis personajes", que es donde están todos los personajes. La lógica (`lib/google-account.ts`) no importa Supabase y se testea con un login falso; la implementación real es `lib/supabase/google-auth.ts`.
7. **Sin cambios en la CSP** (ADR 0024): ir a Google es una navegación de toda la página, que `connect-src` y `form-action` no limitan. El secreto del cliente de Google vive solo en el panel de Supabase, nunca en el repo.

## Consecuencias

- Los personajes se abren en cualquier dispositivo entrando con Google. La copia JSON (ADR 0026) sigue sirviendo como respaldo.
- Configuración del dueño: proyecto y cliente OAuth en Google Cloud, proveedor Google y "Allow manual linking" en Supabase, URLs de redirección y la variable en Vercel. Guía en la carpeta del proyecto (`guias/conectar-google.md`).
- El login por email del ADR 0014 sigue en pausa; el panel de la hoja no cambia.
- Pendiente: borrar usuarios anónimos huérfanos y llevar el homebrew a la nube.
