import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">
        Gestor de personajes
      </h1>
      <p className="max-w-md text-muted-foreground">
        Hojas de personaje compatibles con 5e (SRD 5.1 y 5.2.1), con contenido
        homebrew. En construcción.
      </p>
      <Button>Crear personaje</Button>
    </main>
  );
}
