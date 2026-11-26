// Avisos del motor en lenguaje simple para la hoja (ADR 0025).
//
// `calculateSheet` anota en `issues` todo lo que no pudo aplicar: contenido
// que no encuentra, elecciones que no valen, límites superados. Antes nadie
// los mostraba: si una clase homebrew no estaba en este navegador, la hoja se
// calculaba sin ella y los números salían mal sin aviso. Integridad del
// procesamiento: SOC 2 PI1.3 · ISO 27001 A.8.26.
//
// El caso más común (y el que más confunde) es el contenido que falta, así que
// se separa y se explica. El resto se muestra tal cual lo escribe el motor.

import type { ContentType } from "@/rules-engine/schemas";

export type MissingContent = { type: ContentType; id: string; label: string };

export type SheetIssueSummary = {
  // Contenido que no está en este navegador (casi siempre homebrew).
  missing: MissingContent[];
  // Contenido que existe pero es de un paquete que el personaje no activó.
  inactive: { id: string; packageId: string }[];
  // Todo lo demás, con el texto del motor.
  other: string[];
};

const typeLabels: Record<ContentType, string> = {
  class: "clase",
  subclass: "subclase",
  species: "especie",
  background: "trasfondo",
  feat: "dote",
  item: "objeto",
  spell: "conjuro",
};

// Deben coincidir con los textos de `calculateSheet` (`find`). Un test con el
// motor real avisa si alguno cambia.
const MISSING = /^No se encontró (\w+) "([^"]+)"$/;
const INACTIVE = /^"([^"]+)" es del paquete "([^"]+)", que no está activo$/;

const isContentType = (value: string): value is ContentType =>
  value in typeLabels;

export function summarizeSheetIssues(issues: string[]): SheetIssueSummary {
  const summary: SheetIssueSummary = { missing: [], inactive: [], other: [] };
  // El motor puede anotar lo mismo varias veces (por ejemplo, un objeto que
  // falta y se busca en dos lugares): se muestra una sola vez.
  for (const issue of new Set(issues)) {
    const missing = MISSING.exec(issue);
    if (missing && isContentType(missing[1])) {
      const type = missing[1];
      summary.missing.push({ type, id: missing[2], label: typeLabels[type] });
      continue;
    }
    const inactive = INACTIVE.exec(issue);
    if (inactive) {
      summary.inactive.push({ id: inactive[1], packageId: inactive[2] });
      continue;
    }
    summary.other.push(issue);
  }
  return summary;
}

export function hasSheetIssues(summary: SheetIssueSummary): boolean {
  return (
    summary.missing.length + summary.inactive.length + summary.other.length > 0
  );
}
