"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Character } from "@/rules-engine/schemas";

type Props = {
  character: Character;
  subtitle: string;
  // Devuelve false si no se pudo borrar (por ejemplo, sin conexión).
  onDelete: (characterId: string) => Promise<boolean>;
};

type DeleteState = "idle" | "confirming" | "deleting" | "failed";

// Una fila de "Mis personajes" con su botón para borrar (ADR 0018).
// Borrar no se puede deshacer, así que pide confirmación en la misma fila en
// vez de un diálogo del navegador (`confirm()`), que no se puede estilar y en
// algunos celulares se bloquea.
export function CharacterListItem({ character, subtitle, onDelete }: Props) {
  const [state, setState] = useState<DeleteState>("idle");
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Al abrir la confirmación, el botón "Borrar" desaparece. Para que quien usa
  // teclado no pierda el foco, se lo pasa a "Cancelar" (la opción segura).
  useEffect(() => {
    if (state === "confirming") cancelRef.current?.focus();
  }, [state]);

  async function handleConfirm() {
    setState("deleting");
    const ok = await onDelete(character.id);
    // Si salió bien, la lista saca esta fila: no hace falta cambiar el estado.
    if (!ok) setState("failed");
  }

  const asking = state !== "idle";

  return (
    <li className="grid gap-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <Link
          href={`/characters/${character.id}`}
          className="grid min-w-0 flex-1 gap-0.5 rounded-md outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="truncate font-heading text-lg font-bold">
            {character.name}
          </span>
          <span className="text-sm text-muted-foreground">{subtitle}</span>
        </Link>
        {!asking && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setState("confirming")}
            aria-label={`Borrar a ${character.name}`}
          >
            Borrar
          </Button>
        )}
      </div>

      {asking && (
        <div
          role="group"
          aria-label={`Confirmar borrado de ${character.name}`}
          className="grid gap-2 border-t border-border pt-2"
        >
          <p className="text-sm">
            ¿Borrar a <strong>{character.name}</strong>? No se puede deshacer.
          </p>
          {state === "failed" && (
            <p className="text-sm text-destructive" role="alert">
              No se pudo borrar. Revisá la conexión y probá de nuevo.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirm}
              disabled={state === "deleting"}
            >
              {state === "deleting" ? "Borrando…" : "Sí, borrar"}
            </Button>
            <Button
              ref={cancelRef}
              variant="outline"
              size="sm"
              onClick={() => setState("idle")}
              disabled={state === "deleting"}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
