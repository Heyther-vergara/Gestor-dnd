"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { PlayableSheet } from "@/components/sheet/playable-sheet";
import { Button } from "@/components/ui/button";
import { loadAndSync } from "@/lib/character-sync";
import { characterSubtitle } from "@/lib/format";
import { srd2024Index } from "@/lib/srd-2024";
import { getCharacterStore } from "@/lib/supabase/character-store";
import { type Character, characterSchema } from "@/rules-engine/schemas";

type LoadState =
  | { status: "loading" }
  | { status: "found"; character: Character }
  | { status: "missing" };

// La hoja de un personaje creado (ADR 0015). A diferencia de la hoja de
// ejemplo, el personaje no está en el código: primero se busca lo guardado y
// recién entonces se muestra la hoja jugable.
export function SavedCharacterSheet({ characterId }: { characterId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    let local: Storage;
    try {
      local = window.localStorage;
    } catch {
      queueMicrotask(() => setState({ status: "missing" }));
      return;
    }
    loadAndSync(local, getCharacterStore(), characterId)
      .then(({ character }) => {
        if (cancelled) return;
        setState(
          character
            ? { status: "found", character: withFreshPlayState(character) }
            : { status: "missing" },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  if (state.status === "loading") {
    return (
      <p className="px-4 py-6 text-center text-muted-foreground" role="status">
        Cargando personaje…
      </p>
    );
  }

  if (state.status === "missing") {
    return (
      <div className="grid justify-items-center gap-4 px-4 py-16 text-center">
        <p>No encontramos este personaje.</p>
        <Button asChild variant="outline">
          <Link href="/characters">Volver a mis personajes</Link>
        </Button>
      </div>
    );
  }

  // PlayableSheet vuelve a leer lo guardado (con el daño, los dados gastados,
  // etc.). Lo que recibe acá es el "estado inicial": el mismo personaje sin
  // nada de la partida, para "Volver al estado inicial".
  return (
    <PlayableSheet
      initialCharacter={state.character}
      subtitle={characterSubtitle(state.character, srd2024Index)}
      resetMode="keep"
    />
  );
}

// El personaje con el estado de partida por defecto (PG llenos, sin dados
// gastados). `parse` aplica los valores por defecto del esquema.
function withFreshPlayState(character: Character): Character {
  return characterSchema.parse({ ...character, playState: undefined });
}
