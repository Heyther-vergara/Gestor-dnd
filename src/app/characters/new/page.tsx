import type { Metadata } from "next";
import Link from "next/link";

import { CharacterCreator } from "@/components/characters/character-creator";

export const metadata: Metadata = {
  title: "Crear personaje · Gestor de personajes 5e",
};

export default function NewCharacterPage() {
  return (
    <main className="mx-auto grid w-full max-w-2xl content-start gap-5 px-4 py-6">
      <header className="grid gap-1">
        <Link
          href="/characters"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Mis personajes
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-wide">
          Crear personaje
        </h1>
        <p className="text-muted-foreground">
          Nivel 1, con el contenido del SRD 5.2.1.
        </p>
      </header>
      <CharacterCreator />
    </main>
  );
}
