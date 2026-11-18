"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { CharacterListItem } from "@/components/characters/character-list-item";
import { Button } from "@/components/ui/button";
import type { SavedCharacter } from "@/lib/character-storage";
import { deleteCharacter, listCharacters } from "@/lib/character-sync";
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

  // Borra en la nube y en el navegador; si sale bien, saca la fila de la lista.
  async function handleDelete(characterId: string): Promise<boolean> {
    let ok: boolean;
    try {
      ok = await deleteCharacter(
        window.localStorage,
        getCharacterStore(),
        characterId,
      );
    } catch {
      ok = false;
    }
    if (ok) {
      setState((current) =>
        current.status === "loaded"
          ? {
              ...current,
              characters: current.characters.filter(
                (saved) => saved.character.id !== characterId,
              ),
            }
          : current,
      );
    }
    return ok;
  }

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
            <CharacterListItem
              key={character.id}
              character={character}
              subtitle={characterSubtitle(character, srd2024Index)}
              onDelete={handleDelete}
            />
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
