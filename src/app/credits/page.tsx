import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Créditos · Gestor de personajes 5e",
};

// Página de créditos (ADR 0018). La licencia CC-BY-4.0 del SRD exige mostrar
// la atribución en la obra. El texto de abajo es el que pide Wizards en la
// sección "Información legal" del SRD 5.2.1 en español, copiado tal cual: el
// mismo documento pide no agregar otras atribuciones a Wizards.
const SRD_URL = "https://www.dndbeyond.com/srd";
const CC_BY_URL = "https://creativecommons.org/licenses/by/4.0/legalcode";
const FIVE_E_BITS_URL = "https://github.com/5e-bits/5e-database";

// Aviso de la licencia MIT de 5e-bits/5e-database, de donde sale la
// estructura en JSON del contenido (ADR 0002). La MIT pide incluirlo completo.
// Cada párrafo va en una sola línea para que se acomode al ancho del celular.
const MIT_NOTICE = `MIT License

Copyright (c) [2018-2020] [Adrian Padua, Christopher Ward]

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

const linkClass = "underline underline-offset-4 hover:text-primary";

export default function CreditsPage() {
  return (
    <main className="mx-auto grid w-full max-w-2xl content-start gap-6 px-4 py-6">
      <header className="grid gap-1">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Inicio
        </Link>
        <h1 className="font-heading text-3xl font-bold tracking-wide">
          Créditos
        </h1>
      </header>

      <section aria-labelledby="srd" className="grid gap-2">
        <h2 id="srd" className="font-heading text-xl font-bold">
          Reglas y contenido
        </h2>
        <p>
          Esta obra incluye material procedente del documento de referencia del
          sistema 5.2.1 (“SRD 5.2.1”) de Wizards of the Coast LLC, disponible en{" "}
          <a href={SRD_URL} className={`${linkClass} break-all`}>
            {SRD_URL}
          </a>
          . La licencia sobre el SRD 5.2.1 se concede de acuerdo con la licencia
          internacional de atribución/reconocimiento 4.0 de Creative Commons,
          disponible en{" "}
          <a href={CC_BY_URL} className={`${linkClass} break-all`}>
            {CC_BY_URL}
          </a>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          El contenido del SRD se adaptó a un formato de datos propio para que
          la app pueda calcular la hoja. Los nombres y textos de los conjuros
          son los de la versión en español del SRD 5.2.1. Esta app es compatible
          con la 5E y no es un producto oficial.
        </p>
      </section>

      <section aria-labelledby="data" className="grid gap-2">
        <h2 id="data" className="font-heading text-xl font-bold">
          Datos estructurados
        </h2>
        <p>
          La estructura en JSON del contenido parte del proyecto{" "}
          <a href={FIVE_E_BITS_URL} className={linkClass}>
            5e-bits/5e-database
          </a>
          , que se publica con la licencia MIT:
        </p>
        <pre className="overflow-x-auto rounded-lg border border-border bg-card p-3 font-mono text-xs whitespace-pre-wrap">
          {MIT_NOTICE}
        </pre>
      </section>
    </main>
  );
}
