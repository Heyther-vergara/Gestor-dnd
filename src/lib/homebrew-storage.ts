// Guardado del homebrew en el navegador (localStorage, ADR 0019).
//
// Cada navegador tiene un paquete homebrew propio ("Mi homebrew") con sus
// objetos. Se guarda como un sobre con versión, igual que los personajes
// (ADR 0011), y se valida con Zod al leerlo porque viene de afuera del
// programa. Por ahora no va a la nube: ver el ADR.

import { z } from "zod";

import { contentSchema, packageSchema } from "@/rules-engine/schemas";

import type { KeyValueStorage } from "./character-storage";
import type { HomebrewItem } from "./homebrew";

const STORAGE_VERSION = 1;
export const HOMEBREW_STORAGE_KEY = "gestor-dnd:homebrew";

const homebrewLibrarySchema = z
  .strictObject({
    version: z.literal(STORAGE_VERSION),
    package: packageSchema.refine((p) => p.source === "homebrew", {
      message: "El paquete tiene que ser homebrew",
    }),
    items: z.array(contentSchema),
  })
  // Cada objeto tiene que ser un objeto (no una clase, etc.) de este paquete.
  .refine(
    (library) =>
      library.items.every(
        (item) => item.type === "item" && item.packageId === library.package.id,
      ),
    { message: "Hay contenido que no es un objeto de este paquete" },
  );

export type HomebrewLibrary = {
  package: z.infer<typeof packageSchema>;
  items: HomebrewItem[];
};

// Paquete nuevo y vacío. El id lleva un sufijo al azar para que, cuando el
// homebrew se pueda compartir, dos paquetes de distinta gente no choquen.
export function newHomebrewLibrary(suffix: string): HomebrewLibrary {
  return {
    package: {
      id: `homebrew-${suffix}`,
      name: "Mi homebrew",
      edition: "2024",
      author: "Yo",
      version: "1",
      visibility: "private",
      source: "homebrew",
    },
    items: [],
  };
}

export type LoadHomebrewResult =
  | { status: "loaded"; library: HomebrewLibrary }
  | { status: "empty" }
  // Hay algo pero no sirve (JSON roto, otra versión). No se pisa: puede ser
  // de una versión más nueva de la app, y sobreescribirlo lo perdería.
  | { status: "invalid" };

export function loadHomebrew(storage: KeyValueStorage): LoadHomebrewResult {
  const raw = storage.getItem(HOMEBREW_STORAGE_KEY);
  if (raw === null) return { status: "empty" };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: "invalid" };
  }
  const parsed = homebrewLibrarySchema.safeParse(json);
  if (!parsed.success) return { status: "invalid" };
  return {
    status: "loaded",
    library: {
      package: parsed.data.package,
      // El refine de arriba ya comprobó que todos son objetos.
      items: parsed.data.items.flatMap((item) =>
        item.type === "item" ? [item] : [],
      ),
    },
  };
}

export function saveHomebrew(
  storage: KeyValueStorage,
  library: HomebrewLibrary,
): void {
  storage.setItem(
    HOMEBREW_STORAGE_KEY,
    JSON.stringify({ version: STORAGE_VERSION, ...library }),
  );
}

// Los objetos homebrew de este navegador, o ninguno si no hay o no se puede
// leer. Para la hoja, que solo necesita leerlos.
export function homebrewItemsFrom(storage: KeyValueStorage): HomebrewItem[] {
  const result = loadHomebrew(storage);
  return result.status === "loaded" ? result.library.items : [];
}

// Agrega un objeto nuevo o reemplaza uno con el mismo id (editar).
export function upsertItem(
  library: HomebrewLibrary,
  item: HomebrewItem,
): HomebrewLibrary {
  const exists = library.items.some((i) => i.id === item.id);
  return {
    ...library,
    items: exists
      ? library.items.map((i) => (i.id === item.id ? item : i))
      : [...library.items, item],
  };
}

export function removeItem(
  library: HomebrewLibrary,
  itemId: string,
): HomebrewLibrary {
  return { ...library, items: library.items.filter((i) => i.id !== itemId) };
}
