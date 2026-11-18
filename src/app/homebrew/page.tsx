import type { Metadata } from "next";
import Link from "next/link";

import { HomebrewManager } from "@/components/homebrew/homebrew-manager";

export const metadata: Metadata = {
  title: "Homebrew · Gestor de personajes 5e",
};

// Server Component: solo el marco. Los objetos viven en el navegador, así
// que los maneja HomebrewManager del lado del cliente (ADR 0019 y 0020).
export default function HomebrewPage() {
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
          Homebrew
        </h1>
        <p className="text-muted-foreground">
          Inventa objetos propios y dáselos a tus personajes: la hoja aplica sus
          efectos sola. También puedes importar clases desde un archivo.
        </p>
      </header>
      <HomebrewManager />
    </main>
  );
}
