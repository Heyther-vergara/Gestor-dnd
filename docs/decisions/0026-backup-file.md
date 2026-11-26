# 0026 — Copia de seguridad en un archivo JSON

- Fecha: 2026-11-26
- Estado: aceptada

## Contexto

Con el usuario anónimo (ADR 0013) los personajes quedan a nombre de un usuario que solo existe en un navegador. Si se borran los datos del navegador o se abre la app en otro dispositivo, Supabase crea un usuario nuevo y los personajes de antes quedan en la base sin que nadie pueda llegar a ellos. El homebrew (ADR 0019 y 0020) es peor: vive solo en localStorage.

Opciones:

1. **Exportar / importar un archivo JSON.** No depende de nada externo y sirve también como copia de seguridad. Es manual: si no se descargó, no hay copia.
2. **Vincular la cuenta anónima** a un email (ya hecho y oculto, ADR 0014) o a Google/GitHub (`linkIdentity`). Es automático, pero el email necesita SMTP propio y Google/GitHub una app OAuth configurada en Supabase.

Heyther eligió las dos, empezando por la 1. La 2 va en otro PR.

## Decisión

1. **Un archivo con todo**: en "Mis personajes", "Descargar copia" baja `gestor-dnd-copia-AAAA-MM-DD.json` con todos los personajes y el homebrew. Formato: `{ format: "gestor-dnd/backup", version: 1, exportedAt, characters, homebrew }`. Los personajes van con el mismo sobre que en el navegador y la base (`savedCharacterSchema`) y el homebrew con el de localStorage. No hay formato nuevo que mantener.
2. **Se valida como cualquier dato de afuera**: los mismos esquemas Zod, con los topes del ADR 0023. El archivo puede pesar hasta **5 MB** (se mira `file.size` antes de leerlo y otra vez el texto), hasta 200 personajes y sin ids repetidos.
3. **Al importar gana la copia más nueva**, igual que al sincronizar (ADR 0013): un personaje que ya está aquí con un `savedAt` igual o más nuevo no se toca. Así, importar un archivo viejo no borra lo jugado después. Se guarda con su fecha original.
4. **Se guarda en el navegador y en la nube.** Si la nube falla, queda en el navegador y se sube al abrir la hoja (`loadAndSync`).
5. **Homebrew** (`mergeHomebrew`): si este navegador no tiene, se restaura el de la copia tal cual (mismo id de paquete, así los personajes lo encuentran). Si es el mismo paquete, se agrega lo que falta y gana lo de este navegador. Si es **otro paquete**, no se mezcla: los personajes apuntan al id del paquete y cambiarlo rompería esas referencias. Se avisa.
6. La lógica vive en `lib/character-backup.ts`, sin Supabase ni React, y se testea en Node.

## Consecuencias

- Cualquiera puede recuperar sus personajes sin cuenta, y pasarlos a otro dispositivo.
- Es manual: la app solo recuerda descargar la copia con un texto en la pantalla.
- Un archivo editado a mano que no valida se rechaza entero, con un mensaje.
- El archivo no tiene secretos: solo personajes y homebrew. No incluye el id de usuario de Supabase.
- Pendiente: vincular la cuenta anónima (email o Google/GitHub), y mezclar dos paquetes homebrew distintos si algún día hace falta.
