# 0014 — Login con email (código por email) y vinculación de la hoja anónima

- Fecha: 2026-11-02
- Estado: aceptada

## Contexto

Con el ADR 0013 cada navegador tiene un usuario anónimo de Supabase y la hoja se guarda a su nombre. Eso no deja abrir la misma hoja en otro dispositivo: cada dispositivo es otro usuario. Hace falta una cuenta que se pueda abrir desde cualquier lado, **sin perder la hoja que ya está guardada** con el usuario anónimo.

Opciones para entrar:

1. **Email + contraseña**: hay que manejar contraseñas, "olvidé mi contraseña", etc.
2. **Link mágico por email**: se toca un link y se entra. Pero el link abre la sesión **en el dispositivo donde se toca** (si llega al celular, entra el celular, no la PC), y hay que configurar las URLs de redirección.
3. **Código de un solo uso por email (OTP)**: llega un código de 6 dígitos y se escribe en la app. Funciona igual aunque el email se lea en otro dispositivo.

## Decisión

1. **Código por email (opción 3)**, con Supabase Auth. Sin contraseñas.
2. **Un solo botón, "Entrar con email"**, que decide solo qué hacer (`lib/email-login.ts`, `requestLoginCode`):
   - Si la sesión es **anónima**, se le **agrega el email** (`updateUser({ email })`). Para Supabase es el mismo usuario (mismo id), así que **la hoja guardada pasa a la cuenta sin copiar nada**: la fila de `characters` ya tiene ese `user_id`. Se confirma con el código (`verifyOtp`, tipo `email_change`).
   - Si el email **ya es de una cuenta** (Supabase responde `email_exists`), se **entra a esa cuenta** (`signInWithOtp`, y `verifyOtp` tipo `email`). Es el caso "abrir la hoja en otro dispositivo".
3. **Al entrar a una cuenta que ya existía, gana la hoja de la cuenta** (`loadAndSync` con `preferRemote`), aunque la copia del navegador sea más nueva: esa copia era del usuario anónimo de este dispositivo. Si la cuenta no tiene hoja, se sube la del navegador (no se pierde nada).
4. **Al salir**, se borra la copia del navegador (puede ser una computadora compartida) y la hoja vuelve a empezar con un usuario anónimo nuevo.
5. **Mientras se recarga la hoja no se guarda nada** (acción `reload` del reducer, que vuelve a `loading`), para no pisar la hoja de la cuenta con la del anónimo.
6. Igual que en el ADR 0013, **la lógica no importa Supabase**: `EmailAuth` es una interfaz chica y se testea con un login falso. La implementación real es `lib/supabase/email-auth.ts`.
7. **Sin cambios en la base**: la tabla y RLS del ADR 0013 ya separan las hojas por `user_id`.

## Consecuencias

- Hay que configurar el panel de Supabase: poner `{{ .Token }}` en las plantillas de email (Magic Link, Change Email Address y Confirm signup) para que el email traiga el código.
- El servidor de emails que trae Supabase es para pruebas: manda pocos emails por hora y solo a direcciones del equipo del proyecto. Para usuarios reales hace falta un SMTP propio (por ejemplo Resend); queda para cuando la app tenga usuarios.
- El usuario anónimo del segundo dispositivo queda huérfano en la base al entrar a la cuenta (igual que los anónimos que no vuelven, ADR 0013).
- Sigue siendo **una hoja por usuario** (la de ejemplo). Varias hojas por cuenta llegan con el creador de personajes.
