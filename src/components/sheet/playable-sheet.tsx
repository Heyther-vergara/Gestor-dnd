"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { clearCharacter, saveCharacter } from "@/lib/character-storage";
import {
  createRemoteSaver,
  loadAndSync,
  type RemoteCharacterStore,
} from "@/lib/character-sync";
import {
  createSavedSheetReducer,
  initialSavedSheetState,
  type SaveStatus,
} from "@/lib/saved-sheet-reducer";
import { coinsText, inventoryLines } from "@/lib/format";
import type { HomebrewItem } from "@/lib/homebrew";
import { srd2024Index } from "@/lib/srd-2024";
import { getCharacterStore } from "@/lib/supabase/character-store";
import { type ContentIndex, calculateSheet } from "@/rules-engine/engine";
import type { Character } from "@/rules-engine/schemas";

import { AccountPanel } from "./account-panel";
import { ClassResources } from "./class-resources";
import { HomebrewItemsPanel } from "./homebrew-items-panel";
import { PlayPanel } from "./play-panel";
import { SheetView } from "./sheet-view";

type Cloud = {
  store: RemoteCharacterStore;
  saver: ReturnType<typeof createRemoteSaver>;
};

// La hoja en partida. Lleva el personaje en memoria (useReducer), recalcula la
// hoja en cada cambio y la guarda en la nube (ADR 0013) y en el navegador
// (ADR 0011), así recargar la página no borra el daño ni las salvaciones.
//
// `resetMode` dice qué hace "Volver al estado inicial":
// - "clear" (hoja de ejemplo): borra lo guardado; el personaje vive en el código.
// - "keep" (personajes creados, ADR 0015): pone en cero el estado de partida
//   y deja el resto del personaje (por ejemplo, los objetos homebrew que se
//   le dieron, ADR 0019). Borrar lo guardado borraría el personaje entero.
//
// `contentIndex` es el contenido que usa el motor: el SRD y, en los
// personajes creados, también el homebrew del navegador. `homebrewItems`,
// si viene, muestra el panel para darle esos objetos al personaje.
export function PlayableSheet({
  initialCharacter,
  subtitle,
  resetMode = "clear",
  contentIndex = srd2024Index,
  homebrewItems,
}: {
  initialCharacter: Character;
  subtitle: string;
  resetMode?: "clear" | "keep";
  contentIndex?: ContentIndex;
  homebrewItems?: readonly HomebrewItem[];
}) {
  // El reducer necesita el contenido para que el motor calcule los PG
  // máximos y los dados de golpe. Se rearma solo si cambia el contenido.
  const savedSheetReducer = useMemo(
    () => createSavedSheetReducer(contentIndex),
    [contentIndex],
  );
  const [{ session, saveStatus }, dispatch] = useReducer(
    savedSheetReducer,
    initialCharacter,
    initialSavedSheetState,
  );
  const characterId = initialCharacter.id;
  const loaded = saveStatus !== "loading";
  // Pedido de volver a leer lo guardado. Cambia al entrar o salir de la
  // cuenta (ADR 0014); cada objeto nuevo vuelve a correr el efecto de carga.
  const [syncRequest, setSyncRequest] = useState({ preferRemote: false });

  // La nube se arma una sola vez y solo en el navegador (en un efecto, nunca
  // durante el render, que también corre en el servidor). Queda en null si
  // Supabase no está configurado.
  const cloudRef = useRef<Cloud | null | undefined>(undefined);
  function getCloud(): Cloud | null {
    if (cloudRef.current === undefined) {
      const store = getCharacterStore();
      cloudRef.current = store
        ? {
            store,
            saver: createRemoteSaver(store, (ok) =>
              dispatch({ type: "cloud-result", ok }),
            ),
          }
        : null;
    }
    return cloudRef.current;
  }

  // 1) Al montar, recupera lo guardado (nube y navegador) y se queda con lo
  // más nuevo. Se hace en un efecto y no al crear el estado porque el
  // servidor no tiene localStorage ni sesión: si el primer render del cliente
  // fuera distinto al del servidor, React avisa un error de hidratación.
  useEffect(() => {
    // Si el usuario sale de la página antes de que responda la nube, no
    // tocamos un componente que ya no existe.
    let cancelled = false;
    let local: Storage;
    try {
      local = window.localStorage;
    } catch {
      dispatch({ type: "storage-failed" });
      return;
    }
    loadAndSync(local, getCloud()?.store ?? null, characterId, syncRequest)
      .then((result) => {
        if (!cancelled) dispatch({ type: "storage-loaded", ...result });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "storage-failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, syncRequest]);

  // 2) Cada vez que cambia el personaje, lo guarda. Espera a que termine la
  // carga: si no, guardaría el personaje inicial encima de lo guardado.
  useEffect(() => {
    if (!loaded) return;
    // Volver al estado inicial borra lo guardado en vez de copiarlo.
    const isReset =
      resetMode === "clear" && session.character === initialCharacter;
    try {
      if (isReset) clearCharacter(window.localStorage, characterId);
      else saveCharacter(window.localStorage, session.character);
    } catch {
      dispatch({ type: "storage-failed" });
    }
    // La nube va aparte y sin esperar: el resultado llega como "cloud-result".
    const saver = getCloud()?.saver;
    if (saver) {
      if (isReset) void saver.remove(characterId);
      else void saver.save(session.character);
    }
  }, [session.character, initialCharacter, characterId, loaded, resetMode]);

  // Cambió el usuario: se vuelve a cargar la hoja desde la nube.
  // - Al entrar a una cuenta que ya existía, gana la hoja de la cuenta.
  // - Al salir, se borra la copia de este navegador (puede ser una
  //   computadora compartida) y se empieza de cero con un usuario anónimo.
  function handleUserSwitched(change: "signed-in" | "signed-out") {
    if (change === "signed-out") {
      try {
        clearCharacter(window.localStorage, characterId);
      } catch {
        // Si el navegador no deja tocar el almacenamiento, no hay copia.
      }
    }
    dispatch({ type: "reload", character: initialCharacter });
    setSyncRequest({ preferRemote: change === "signed-in" });
  }

  const sheet = useMemo(
    () => calculateSheet(session.character, contentIndex),
    [session.character, contentIndex],
  );

  return (
    <SheetView
      name={session.character.name}
      subtitle={subtitle}
      sheet={sheet}
      equipment={{
        items: inventoryLines(session.character.inventory, contentIndex),
        coins: coinsText(session.character.coins),
      }}
      resourcePanel={
        sheet.resources.length > 0 && (
          <ClassResources
            resources={sheet.resources}
            disabled={!loaded}
            onSpend={(resourceId, amount) =>
              dispatch({ type: "spend-resource", resourceId, amount })
            }
          />
        )
      }
      homebrewPanel={
        homebrewItems && (
          <HomebrewItemsPanel
            items={homebrewItems}
            inventory={session.character.inventory}
            disabled={!loaded}
            onGive={(item) => dispatch({ type: "give-item", item })}
            onTake={(itemId) => dispatch({ type: "take-item", itemId })}
          />
        )
      }
      playPanel={
        <div className="grid gap-2">
          <PlayPanel
            hitPoints={sheet.hitPoints}
            hitDice={sheet.hitDice}
            deathSaves={sheet.deathSaves}
            exhaustion={sheet.exhaustion}
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
                dispatch({
                  type: "reset",
                  character:
                    resetMode === "keep"
                      ? {
                          ...session.character,
                          playState: initialCharacter.playState,
                        }
                      : initialCharacter,
                })
              }
            >
              Volver al estado inicial
            </Button>
          </div>
          <AccountPanel onUserSwitched={handleUserSwitched} />
        </div>
      }
    />
  );
}

const saveStatusText: Record<SaveStatus, string> = {
  loading: "",
  cloud: "Los cambios se guardan en la nube.",
  local: "Los cambios se guardan en este navegador.",
  "cloud-error":
    "No se pudo guardar en la nube: por ahora los cambios quedan en este navegador.",
  unavailable:
    "Este navegador no permite guardar: los cambios se pierden al recargar.",
};
