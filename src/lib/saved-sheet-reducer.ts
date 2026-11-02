// Reducer de la hoja guardada: envuelve al de partida (play-reducer) y le
// suma el estado del guardado (ADR 0011, y la nube en el ADR 0013).
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
// - "cloud": lo que ves está guardado en la nube (y en este navegador).
// - "local": está guardado solo en este navegador (la nube no está configurada).
// - "cloud-error": la nube falló (sin conexión…); queda la copia del navegador.
// - "unavailable": el navegador no deja guardar (modo privado, sin espacio…).
export type SaveStatus =
  "loading" | "cloud" | "local" | "cloud-error" | "unavailable";

export type SavedSheetState = {
  session: PlaySession;
  saveStatus: SaveStatus;
};

export type SavedSheetAction =
  | PlayAction
  // Terminó de leer lo guardado. `character` es null si no había nada (o no
  // servía): se sigue con el personaje inicial. `where` dice si la nube
  // respondió.
  | {
      type: "storage-loaded";
      character: Character | null;
      where: "cloud" | "local";
    }
  | { type: "storage-failed" }
  // Cambió el usuario (entró o salió de la cuenta, ADR 0014): vuelve a
  // "loading" con `character` hasta que termine de leer lo guardado. Mientras
  // está en "loading" no se guarda nada, así no se pisa la hoja de la cuenta.
  | { type: "reload"; character: Character }
  // Terminó un guardado en la nube, bien o mal.
  | { type: "cloud-result"; ok: boolean };

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
          saveStatus: action.where,
        };
      case "reload":
        return {
          session: { character: action.character, message: null },
          saveStatus: "loading",
        };
      case "storage-failed":
        return { ...state, saveStatus: "unavailable" };
      case "cloud-result": {
        // Un resultado que llega antes de terminar la carga no cambia nada.
        if (state.saveStatus === "loading") return state;
        const saveStatus = action.ok ? "cloud" : "cloud-error";
        // Mismo estado → mismo objeto, así React no vuelve a dibujar.
        return state.saveStatus === saveStatus
          ? state
          : { ...state, saveStatus };
      }
      default:
        return { ...state, session: playReducer(state.session, action) };
    }
  };
}
