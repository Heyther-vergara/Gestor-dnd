"use client";

import { useMemo, useReducer } from "react";

import { Button } from "@/components/ui/button";
import { createPlayReducer } from "@/lib/play-reducer";
import { srd2024Index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";
import type { Character } from "@/rules-engine/schemas";

import { PlayPanel } from "./play-panel";
import { SheetView } from "./sheet-view";

// Se crea una sola vez: el reducer necesita el contenido para que el motor
// calcule los PG máximos y los dados de golpe.
const playReducer = createPlayReducer(srd2024Index);

// La hoja en partida. Guarda el personaje en memoria (useReducer) y recalcula
// la hoja en cada cambio. Hasta que haya base de datos, recargar la página
// vuelve al personaje inicial (ADR 0009).
export function PlayableSheet({
  initialCharacter,
  subtitle,
}: {
  initialCharacter: Character;
  subtitle: string;
}) {
  const [session, dispatch] = useReducer(playReducer, {
    character: initialCharacter,
    message: null,
  });
  const sheet = useMemo(
    () => calculateSheet(session.character, srd2024Index),
    [session.character],
  );

  return (
    <SheetView
      name={session.character.name}
      subtitle={subtitle}
      sheet={sheet}
      playPanel={
        <div className="grid gap-2">
          <PlayPanel
            hitDice={sheet.hitDice}
            deathSaves={sheet.deathSaves}
            message={session.message}
            dispatch={dispatch}
          />
          <Button
            variant="link"
            size="sm"
            className="justify-self-end"
            onClick={() =>
              dispatch({ type: "reset", character: initialCharacter })
            }
          >
            Volver al estado inicial
          </Button>
        </div>
      }
    />
  );
}
