// Índice con todo el contenido del paquete SRD 2024, validado con Zod.
// Se arma una sola vez al importar el módulo (en el servidor).

import backgrounds from "@/content/srd-2024/backgrounds.json";
import classes from "@/content/srd-2024/classes.json";
import feats from "@/content/srd-2024/feats.json";
import items from "@/content/srd-2024/items.json";
import species from "@/content/srd-2024/species.json";
import spells from "@/content/srd-2024/spells.json";
import { createContentIndex } from "@/rules-engine/engine";
import { contentSchema } from "@/rules-engine/schemas";

export const srd2024Index = createContentIndex(
  [...classes, ...species, ...backgrounds, ...feats, ...spells, ...items].map(
    (c) => contentSchema.parse(c),
  ),
);
