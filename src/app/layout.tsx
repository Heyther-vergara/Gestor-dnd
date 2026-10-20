import type { Metadata } from "next";
import { Alegreya_Sans, Alegreya_SC, Geist_Mono } from "next/font/google";
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
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
