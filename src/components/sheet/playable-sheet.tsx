"use client";

import { useEffect, useMemo, useReducer } from "react";

import { Button } from "@/components/ui/button";
import {
  clearCharacter,
  loadCharacter,
  saveCharacter,
} from "@/lib/character-storage";
import {
  createSavedSheetReducer,
  initialSavedSheetState,
  type SaveStatus,
} from "@/lib/saved-sheet-reducer";
import { srd2024Index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";
import type { Character } from "@/rules-engine/schemas";

import { PlayPanel } from "./play-panel";
import { SheetView } from "./sheet-view";

// Se crea una sola vez: el reducer necesita el contenido para que el motor
// calcule los PG máximos y los dados de golpe.
const savedSheetReducer = createSavedSheetReducer(srd2024Index);

// La hoja en partida. Lleva el personaje en memoria (useReducer), recalcula la
// hoja en cada cambio y la guarda en el navegador (ADR 0011), así recargar la
// página no borra el daño ni las salvaciones.
export function PlayableSheet({
  initialCharacter,
  subtitle,
}: {
  initialCharacter: Character;
  subtitle: string;
}) {
  const [{ session, saveStatus }, dispatch] = useReducer(
    savedSheetReducer,
    initialCharacter,
    initialSavedSheetState,
  );
  const characterId = initialCharacter.id;

  // 1) Al montar, recupera lo guardado. Se hace en un efecto y no al crear el
  // estado porque el servidor no tiene localStorage: si el primer render del
  // cliente fuera distinto al del servidor, React avisa un error de hidratación.
  useEffect(() => {
    try {
      const result = loadCharacter(window.localStorage, characterId);
      dispatch({
        type: "storage-loaded",
        character: result.status === "loaded" ? result.saved.character : null,
      });
    } catch {
      dispatch({ type: "storage-failed" });
    }
  }, [characterId]);

  // 2) Cada vez que cambia el personaje, lo guarda. Espera a que termine la
  // carga: si no, guardaría el personaje inicial encima de lo guardado.
  useEffect(() => {
    if (saveStatus !== "saved") return;
    try {
      // Volver al estado inicial borra lo guardado en vez de copiarlo.
      if (session.character === initialCharacter) {
        clearCharacter(window.localStorage, characterId);
      } else {
        saveCharacter(window.localStorage, session.character);
      }
    } catch {
      dispatch({ type: "storage-failed" });
    }
  }, [session.character, initialCharacter, characterId, saveStatus]);

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
            hitPoints={sheet.hitPoints}
            hitDice={sheet.hitDice}
            deathSaves={sheet.deathSaves}
            message={session.message}
            dispatch={dispatch}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-4">
            <p
              className="text-sm text-muted-foreground"
              role="status"
              aria-live="polite"
            >
              {saveStatusText[saveStatus]}
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() =>
                dispatch({ type: "reset", character: initialCharacter })
              }
            >
              Volver al estado inicial
            </Button>
          </div>
        </div>
      }
    />
  );
}

const saveStatusText: Record<SaveStatus, string> = {
  loading: "",
  saved: "Los cambios se guardan en este navegador.",
  unavailable:
    "Este navegador no permite guardar: los cambios se pierden al recargar.",
};
