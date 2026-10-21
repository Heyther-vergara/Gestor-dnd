import type { Metadata } from "next";

import { PlayableSheet } from "@/components/sheet/playable-sheet";
import { sampleCharacter } from "@/lib/sample-character";
import { srd2024Index } from "@/lib/srd-2024";

export const metadata: Metadata = {
  title: "Hoja de ejemplo · Gestor de personajes 5e",
};

// Server Component: arma el subtítulo y le pasa el personaje a PlayableSheet,
// que es un Client Component porque la hoja se edita en partida.
export default function ExampleSheetPage() {
  const nameOf = (id: string) => srd2024Index.get(id)?.name ?? id;

  const subtitle = [
    nameOf(sampleCharacter.speciesId),
    ...sampleCharacter.classes.map((c) => `${nameOf(c.classId)} ${c.level}`),
    nameOf(sampleCharacter.backgroundId),
  ].join(" · ");

  return (
    <main className="flex-1">
      <PlayableSheet initialCharacter={sampleCharacter} subtitle={subtitle} />
    </main>
  );
}
