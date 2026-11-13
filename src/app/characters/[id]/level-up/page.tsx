import type { Metadata } from "next";
import Link from "next/link";

import { LevelUpScreen } from "@/components/characters/level-up-screen";

export const metadata: Metadata = {
  title: "Subir de nivel · Gestor de personajes 5e",
};

// Server Component: solo lee el id de la URL. El personaje está guardado en
// el navegador y en la nube del usuario, así que lo busca LevelUpScreen del
// lado del cliente (ADR 0016).
export default async function LevelUpPage({
  params,
}: PageProps<"/characters/[id]/level-up">) {
  const { id } = await params;
  return (
    <main className="flex-1">
      <nav className="mx-auto w-full max-w-2xl px-4 pt-4">
        <Link
          href={`/characters/${id}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Volver a la hoja
        </Link>
      </nav>
      <LevelUpScreen characterId={id} />
    </main>
  );
}
