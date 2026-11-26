"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { withHomebrew } from "@/lib/homebrew";
import { homebrewContentFrom } from "@/lib/homebrew-storage";
import { srd2024Index } from "@/lib/srd-2024";
import type { ContentIndex } from "@/rules-engine/engine";
import type { Content } from "@/rules-engine/schemas";

// El contenido que ve el motor en las pantallas: el SRD más el homebrew de
// este navegador (objetos y clases importadas, ADR 0019 y 0020).
//
// El homebrew está en localStorage, que no existe en el servidor: el primer
// render usa solo el SRD y, después de montar, se suma el homebrew.
// `reloadKey`: al cambiarlo se vuelve a leer (por ejemplo, después de importar
// una copia de seguridad, ADR 0026).
export function useHomebrewIndex(reloadKey = 0): ContentIndex {
  const [homebrew, setHomebrew] = useState<Content[]>([]);
  useEffect(() => {
    let content: Content[];
    try {
      content = homebrewContentFrom(window.localStorage);
    } catch {
      return; // Sin almacenamiento: solo SRD.
    }
    // El efecto corre después del render: aquí sí se puede cambiar el estado.
    queueMicrotask(() => setHomebrew(content));
  }, [reloadKey]);
  return useMemo(() => withHomebrew(srd2024Index, homebrew), [homebrew]);
}

// Para no pasar el índice por props a cada paso del creador.
export const ContentIndexContext = createContext<ContentIndex>(srd2024Index);

export const useContentIndex = (): ContentIndex =>
  useContext(ContentIndexContext);
