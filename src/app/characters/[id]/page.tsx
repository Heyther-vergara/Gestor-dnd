import type { Metadata } from "next";
import Link from "next/link";

import { SavedCharacterSheet } from "@/components/characters/saved-character-sheet";

export const metadata: Metadata = {
  title: "Hoja de personaje · Gestor de personajes 5e",
};

// Server Component: solo lee el id de la URL. El personaje está guardado en
// el navegador y en la nube del usuario, así que lo busca SavedCharacterSheet
// del lado del cliente.
export default async function CharacterPage({
  params,
}: PageProps<"/characters/[id]">) {
  const { id } = await params;
  return (
    <main className="flex-1">
      <nav className="mx-auto w-full max-w-2xl px-4 pt-4">
        <Link
          href="/characters"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Mis personajes
        </Link>
      </nav>
      <SavedCharacterSheet characterId={id} />
    </main>
  );
}
