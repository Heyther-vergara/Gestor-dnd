import Link from "next/link";

import { hasSheetIssues, summarizeSheetIssues } from "@/lib/sheet-issues";

// Recuadro de avisos arriba de la hoja (ADR 0027). Si el motor no pudo
// aplicar algo, se dice aquí, para que nadie confíe en un número que está mal.
export function SheetIssues({ issues }: { issues: string[] }) {
  const summary = summarizeSheetIssues(issues);
  if (!hasSheetIssues(summary)) return null;

  return (
    <section
      role="alert"
      aria-labelledby="sheet-issues-title"
      className="grid gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <h2 id="sheet-issues-title" className="font-bold">
        Revisa esta hoja: algunos números pueden estar mal
      </h2>

      {summary.missing.length > 0 && (
        <div className="grid gap-1">
          <p>
            Este personaje usa contenido que no está en este navegador. La hoja
            se calcula sin él:
          </p>
          <ul className="list-disc pl-5">
            {summary.missing.map((m) => (
              <li key={`${m.type}-${m.id}`}>
                {m.label} <code className="font-mono">{m.id}</code>
              </li>
            ))}
          </ul>
          <p>
            Si es homebrew, impórtalo de nuevo en{" "}
            <Link href="/homebrew" className="underline underline-offset-4">
              Homebrew
            </Link>{" "}
            desde el archivo original. El homebrew se guarda solo en el
            navegador donde lo importaste.
          </p>
        </div>
      )}

      {summary.inactive.length > 0 && (
        <div className="grid gap-1">
          <p>
            Este contenido es de un paquete que el personaje no tiene activo:
          </p>
          <ul className="list-disc pl-5">
            {summary.inactive.map((i) => (
              <li key={i.id}>
                <code className="font-mono">{i.id}</code> (paquete{" "}
                <code className="font-mono">{i.packageId}</code>)
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.other.length > 0 && (
        <div className="grid gap-1">
          <p>Otros avisos:</p>
          <ul className="list-disc pl-5">
            {summary.other.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
