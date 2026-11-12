import type { Metadata } from "next";
import Link from "next/link";

import { CharacterList } from "@/components/characters/character-list";

export const metadata: Metadata = {
  title: "Mis personajes · Gestor de personajes 5e",
};

export default function CharactersPage() {
  return (
    <main className="mx-auto grid w-full max-w-2xl content-start gap-5 px-4 py-6">
      <header className="grid gap-1">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Inicio
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-wide">
          Mis personajes
        </h1>
      </header>
      <CharacterList />
    </main>
  );
}
