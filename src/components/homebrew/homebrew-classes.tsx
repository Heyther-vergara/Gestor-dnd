"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { withHomebrew } from "@/lib/homebrew";
import {
  type HomebrewClass,
  parseClassFile,
  removeClass,
  upsertClass,
} from "@/lib/homebrew-class";
import type { HomebrewLibrary } from "@/lib/homebrew-storage";
import { srd2024Index } from "@/lib/srd-2024";

// "Clases importadas" (ADR 0020): importar una clase homebrew desde un
// archivo JSON y borrarla. El archivo no se sube a ningún lado: se lee en el
// navegador y la clase queda guardada en este navegador, como los objetos.
export function HomebrewClasses({
  library,
  store,
}: {
  library: HomebrewLibrary;
  store: (library: HomebrewLibrary) => boolean;
}) {
  const inputId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const classes = library.classes.filter(
    (c): c is HomebrewClass => c.type === "class",
  );
  const subclassCount = (classId: string) =>
    library.classes.filter(
      (c) => c.type === "subclass" && c.data.classId === classId,
    ).length;

  async function handleFile(file: File) {
    setMessage(null);
    setErrors([]);
    const text = await file.text();
    // Lo que ya existe, para no repetir ids: el SRD y el homebrew guardado.
    const existing = withHomebrew(srd2024Index, [
      ...library.items,
      ...library.classes,
    ]);
    const result = parseClassFile(text, library.package.id, existing);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const { cls } = result.parsed;
    const replacing = library.classes.some((c) => c.id === cls.id);
    if (
      !store({
        ...library,
        classes: upsertClass(library.classes, result.parsed),
      })
    ) {
      setErrors(["No se pudo guardar en este navegador."]);
      return;
    }
    setMessage(
      replacing
        ? `Se actualizó ${cls.name}.`
        : `Se importó ${cls.name}. Ya podés elegirla al crear un personaje.`,
    );
  }

  return (
    <section aria-labelledby="homebrew-classes" className="grid gap-3">
      <h2
        id="homebrew-classes"
        className="font-heading text-xl font-bold text-primary"
      >
        Clases importadas
      </h2>
      <p className="text-sm text-muted-foreground">
        Una clase se importa desde un archivo JSON con el formato del gestor. Si
        importás de nuevo una clase con el mismo id, se actualiza.
      </p>
      <div className="grid gap-1">
        <label htmlFor={inputId} className="text-sm font-medium">
          Archivo de clase (.json)
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/json,.json"
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
        {message && <p className="text-primary">{message}</p>}
        {errors.length > 0 && (
          <ul className="grid list-disc gap-1 pl-5 text-destructive">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>

      {classes.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay clases.</p>
      ) : (
        <ul className="grid gap-2">
          {classes.map((cls) => (
            <ClassRow
              key={cls.id}
              cls={cls}
              subclasses={subclassCount(cls.id)}
              onDelete={() =>
                store({
                  ...library,
                  classes: removeClass(library.classes, cls.id),
                })
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

// Fila con confirmación en el lugar, como los objetos y los personajes.
function ClassRow({
  cls,
  subclasses,
  onDelete,
}: {
  cls: HomebrewClass;
  subclasses: number;
  onDelete: () => boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <li className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-heading text-lg font-bold">{cls.name}</span>
          <span className="text-sm text-muted-foreground">
            d{cls.data.hitDie} · {subclasses}{" "}
            {subclasses === 1 ? "subclase" : "subclases"}
          </span>
        </span>
        {!confirming && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
            aria-label={`Borrar ${cls.name}`}
          >
            Borrar
          </Button>
        )}
      </div>
      {confirming && (
        <div
          role="group"
          aria-label={`Confirmar borrado de ${cls.name}`}
          className="grid gap-2 border-t border-border pt-2"
        >
          <p className="text-sm">
            ¿Borrar <strong>{cls.name}</strong>? Los personajes de esta clase no
            van a poder calcular su hoja hasta que la importes de nuevo.
          </p>
          {failed && (
            <p className="text-sm text-destructive" role="alert">
              No se pudo borrar. Probá de nuevo.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setFailed(!onDelete())}
            >
              Sí, borrar
            </Button>
            <Button
              autoFocus
              variant="outline"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
