import type { Metadata } from "next";
import Link from "next/link";
import { Alegreya_Sans, Alegreya_SC, Geist_Mono } from "next/font/google";
import { ArcaneMargins } from "@/components/arcane-margins";
import { ThemeToggle } from "@/components/theme-toggle";
import { themeScript } from "@/lib/theme";

import "./globals.css";

// Los nombres de variable coinciden con los que usa globals.css (preset de shadcn).
// Estilo "Pergamino sobrio" (ADR 0008): Alegreya Sans para texto y números,
// Alegreya SC (versalitas) solo para títulos. No son fuentes variables, por eso
// hay que pedir los pesos uno por uno.
const alegreyaSans = Alegreya_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const alegreyaSC = Alegreya_SC({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestor de personajes 5e",
  description: "Hojas de personaje compatibles con 5e, con contenido homebrew.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${alegreyaSans.variable} ${alegreyaSC.variable} ${geistMono.variable} h-full antialiased`}
      // El script de abajo agrega la clase .dark antes de que React hidrate:
      // sin esto, React avisaría que el HTML no coincide (ADR 0030).
      suppressHydrationWarning
    >
      <head>
        {/* Aplica el tema guardado antes de pintar, sin destello. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <ArcaneMargins />
        {children}
        {/* La atribución del SRD (CC-BY-4.0) tiene que poder encontrarse desde
            cualquier página: por eso el enlace va en el pie de todas (ADR 0018). */}
        <footer className="mt-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-4 text-center text-sm text-muted-foreground">
          <span>
            Compatible con 5E ·{" "}
            <Link href="/credits" className="underline underline-offset-4">
              Créditos y licencias
            </Link>
          </span>
          <ThemeToggle />
        </footer>
      </body>
    </html>
  );
}
