import type { Metadata } from "next";

import { SheetView } from "@/components/sheet/sheet-view";
import { sampleCharacter } from "@/lib/sample-character";
import { srd2024Index } from "@/lib/srd-2024";
import { calculateSheet } from "@/rules-engine/engine";

export const metadata: Metadata = {
  title: "Hoja de ejemplo · Gestor de personajes 5e",
};

// Server Component: la hoja se calcula en el servidor al compilar la página
// (no hay datos por usuario todavía), así que llega como HTML estático.
export default function ExampleSheetPage() {
  const sheet = calculateSheet(sampleCharacter, srd2024Index);
  const nameOf = (id: string) => srd2024Index.get(id)?.name ?? id;

  const subtitle = [
    nameOf(sampleCharacter.speciesId),
    ...sampleCharacter.classes.map((c) => `${nameOf(c.classId)} ${c.level}`),
    nameOf(sampleCharacter.backgroundId),
  ].join(" · ");

  return (
    <main className="flex-1">
      <SheetView
        name={sampleCharacter.name}
        subtitle={subtitle}
        sheet={sheet}
      />
    </main>
  );
}
