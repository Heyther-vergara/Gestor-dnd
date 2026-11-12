"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { SavedCharacter } from "@/lib/character-storage";
import { listCharacters } from "@/lib/character-sync";
import { characterSubtitle } from "@/lib/format";
import { srd2024Index } from "@/lib/srd-2024";
import { getCharacterStore } from "@/lib/supabase/character-store";

type ListState =
  | { status: "loading" }
  | { status: "loaded"; characters: SavedCharacter[]; where: "cloud" | "local" }
  | { status: "unavailable" };

// "Mis personajes" (ADR 0015): los personajes de este usuario, de la nube y
// del navegador. Es un Client Component porque lo guardado solo existe en el
// navegador (localStorage y la sesión de Supabase).
export function CharacterList() {
  const [state, setState] = useState<ListState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let local: Storage;
    try {
      local = window.localStorage;
    } catch {
      // El efecto corre después del render: acá sí se puede cambiar el estado.
      queueMicrotask(() => setState({ status: "unavailable" }));
      return;
    }
    listCharacters(local, getCharacterStore())
      .then((result) => {
        if (!cancelled) setState({ status: "loaded", ...result });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-4">
      <Button asChild className="justify-self-start">
        <Link href="/characters/new">Crear personaje</Link>
      </Button>

      {state.status === "loading" && (
        <p className="text-muted-foreground" role="status">
          Buscando tus personajes…
        </p>
      )}

      {state.status === "unavailable" && (
        <p className="text-muted-foreground" role="status">
          Este navegador no permite leer lo guardado.
        </p>
      )}

      {state.status === "loaded" && state.characters.length === 0 && (
        <p className="text-muted-foreground">
          Todavía no tenés personajes. Creá el primero.
        </p>
      )}

      {state.status === "loaded" && state.characters.length > 0 && (
        <ul className="grid gap-2">
          {state.characters.map(({ character }) => (
            <li key={character.id}>
              <Link
                href={`/characters/${character.id}`}
                className="grid gap-0.5 rounded-lg border border-border bg-card p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="font-heading text-lg font-bold">
                  {character.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {characterSubtitle(character, srd2024Index)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {state.status === "loaded" && state.where === "local" && (
        <p className="text-sm text-muted-foreground">
          Sin conexión con la nube: se muestran los personajes de este
          navegador.
        </p>
      )}
    </div>
  );
}
