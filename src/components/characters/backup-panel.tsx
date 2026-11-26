"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  backupFileName,
  backupFileTooLargeError,
  createBackup,
  importCharacters,
  isBackupFileTooLarge,
  type MergeHomebrewResult,
  mergeHomebrew,
  parseBackupFile,
} from "@/lib/character-backup";
import type { SavedCharacter } from "@/lib/character-storage";
import { loadHomebrew, saveHomebrew } from "@/lib/homebrew-storage";
import { getCharacterStore } from "@/lib/supabase/character-store";

type Props = {
  // Los personajes que se ven en la lista (nube + navegador).
  characters: SavedCharacter[];
  // Para que la lista vuelva a leer lo guardado después de importar.
  onImported: () => void;
};

type Feedback = { tone: "ok" | "error"; text: string } | null;

const homebrewNotes: Record<MergeHomebrewResult["status"], string | null> = {
  none: null,
  restored: "También se recuperó tu homebrew.",
  merged: "Se agregó el homebrew que faltaba.",
  conflict:
    "El homebrew de la copia no se importó porque este navegador ya tiene otro. Los personajes que lo usen pueden mostrar avisos.",
};

// Copia de seguridad en un archivo (ADR 0026): descargar todos los personajes
// y el homebrew, e importarlos en otro navegador o dispositivo.
export function BackupPanel({ characters, onImported }: Props) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function readHomebrew() {
    const result = loadHomebrew(window.localStorage);
    return result.status === "loaded" ? result.library : null;
  }

  function handleDownload() {
    setFeedback(null);
    let text: string;
    try {
      text = createBackup(characters, readHomebrew());
    } catch {
      setFeedback({ tone: "error", text: "No se pudo armar la copia." });
      return;
    }
    // Se arma el archivo en memoria y se "hace clic" en un enlace temporal
    // con `download`: así el navegador lo guarda en vez de abrirlo.
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName();
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setFeedback(null);
    // Antes de leerlo: un archivo enorme congelaría la pestaña (ADR 0023).
    if (isBackupFileTooLarge(file.size)) {
      setFeedback({ tone: "error", text: backupFileTooLargeError });
      return;
    }
    setBusy(true);
    try {
      const parsed = parseBackupFile(await file.text());
      if (!parsed.ok) {
        setFeedback({ tone: "error", text: parsed.error });
        return;
      }
      const { backup } = parsed;

      // Primero el homebrew: los personajes pueden usar sus objetos y clases.
      const current = loadHomebrew(window.localStorage);
      const merge =
        current.status === "invalid" && backup.homebrew
          ? // Lo guardado no se puede leer: no se pisa (ver homebrew-storage).
            { status: "conflict" as const, library: null }
          : mergeHomebrew(
              current.status === "loaded" ? current.library : null,
              // (Si lo guardado no se puede leer y la copia no trae
              // homebrew, no hay nada que hacer: queda "none".)
              backup.homebrew,
            );
      if (
        (merge.status === "restored" || merge.status === "merged") &&
        merge.library
      ) {
        saveHomebrew(window.localStorage, merge.library);
      }

      const result = await importCharacters(
        window.localStorage,
        getCharacterStore(),
        characters,
        backup.characters,
      );

      const parts = [
        result.imported === 1
          ? "Se importó 1 personaje."
          : `Se importaron ${result.imported} personajes.`,
      ];
      if (result.skipped > 0) {
        parts.push(
          `${result.skipped} ya estaban aquí con cambios más nuevos y no se tocaron.`,
        );
      }
      const note = homebrewNotes[merge.status];
      if (note) parts.push(note);
      if (result.cloudFailed) {
        parts.push(
          "Sin conexión con la nube: quedaron en este navegador y se subirán al abrirlos.",
        );
      }
      setFeedback({ tone: "ok", text: parts.join(" ") });
      onImported();
    } catch {
      setFeedback({ tone: "error", text: "No se pudo importar la copia." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={`${inputId}-title`}
      className="grid gap-3 rounded-lg border border-border bg-card p-3"
    >
      <h2
        id={`${inputId}-title`}
        className="font-heading text-xl font-bold text-primary"
      >
        Copia de seguridad
      </h2>
      <p className="text-sm text-muted-foreground">
        Tus personajes quedan guardados con este navegador. Si borras sus datos
        o cambias de dispositivo, no los vas a ver. Descarga una copia de vez en
        cuando y, si hace falta, impórtala aquí o en otro dispositivo.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={handleDownload}
          disabled={busy || characters.length === 0}
        >
          Descargar copia
        </Button>
      </div>
      <div className="grid gap-1">
        <label htmlFor={inputId} className="text-sm font-medium">
          Importar una copia (.json)
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/json,.json"
          disabled={busy}
          className="text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Vaciar el campo deja volver a elegir el mismo archivo.
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>
      <div role="status" aria-live="polite" className="text-sm">
        {busy && <p className="text-muted-foreground">Importando…</p>}
        {feedback && (
          <p
            className={
              feedback.tone === "ok" ? "text-primary" : "text-destructive"
            }
          >
            {feedback.text}
          </p>
        )}
      </div>
    </section>
  );
}
