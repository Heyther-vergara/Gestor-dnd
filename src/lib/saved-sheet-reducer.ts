// Reducer de la hoja guardada: envuelve al de partida (play-reducer) y le
// suma el estado del guardado en el navegador (ADR 0011).
//
// Se junta todo en un solo reducer porque "terminó la carga" cambia dos cosas
// a la vez (el personaje y el estado del guardado). Con un único dispatch,
// React hace un solo render en vez de dos encadenados.

import type { ContentIndex } from "@/rules-engine/engine";
import type { Character } from "@/rules-engine/schemas";

import {
  createPlayReducer,
  type PlayAction,
  type PlaySession,
} from "./play-reducer";

// - "loading": todavía no leímos lo guardado (primer render, también en el servidor).
// - "saved": lo que ves está guardado en este navegador.
// - "unavailable": el navegador no deja guardar (modo privado, sin espacio…).
export type SaveStatus = "loading" | "saved" | "unavailable";

export type SavedSheetState = {
  session: PlaySession;
  saveStatus: SaveStatus;
};

export type SavedSheetAction =
  | PlayAction
  // Terminó de leer el navegador. `character` es null si no había nada
  // guardado (o no servía): se sigue con el personaje inicial.
  | { type: "storage-loaded"; character: Character | null }
  | { type: "storage-failed" };

export function initialSavedSheetState(character: Character): SavedSheetState {
  return { session: { character, message: null }, saveStatus: "loading" };
}

export function createSavedSheetReducer(contentIndex: ContentIndex) {
  const playReducer = createPlayReducer(contentIndex);

  return function savedSheetReducer(
    state: SavedSheetState,
    action: SavedSheetAction,
  ): SavedSheetState {
    switch (action.type) {
      case "storage-loaded":
        return {
          session: action.character
            ? { character: action.character, message: null }
            : state.session,
          saveStatus: "saved",
        };
      case "storage-failed":
        return { ...state, saveStatus: "unavailable" };
      default:
        return { ...state, session: playReducer(state.session, action) };
    }
  };
}
