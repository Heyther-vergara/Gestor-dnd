import type { ReactNode } from "react";

// Una sección de la hoja que se abre y se cierra (el "desplegable"). Cerrada
// muestra el título y un resumen de una línea (p. ej. "CD 13 · Ataque +5"),
// así la información clave se ve sin abrirla. Usa <details> del navegador:
// funciona con teclado y lector de pantalla, y no necesita JavaScript.
export function Foldout({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const id = `foldout-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id}>
      <details
        open={defaultOpen || undefined}
        className="group rounded-sm border border-border bg-card shadow-[inset_0_0_0_3px_var(--card),inset_0_0_0_4px_var(--border)]"
      >
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-sm px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span className="grid min-w-0 flex-1 gap-0.5">
            <h2
              id={id}
              className="font-heading text-lg leading-tight font-bold text-primary"
            >
              {title}
            </h2>
            {summary && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {summary}
              </span>
            )}
          </span>
          {/* La flecha gira al abrir; es decorativa, por eso aria-hidden. */}
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-5 shrink-0 text-gold transition-transform group-open:rotate-180 motion-reduce:transition-none"
          >
            <path
              d="M5 7.5 10 12.5 15 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </summary>
        <div className="grid gap-3 border-t border-border px-4 pt-3 pb-4">
          {children}
        </div>
      </details>
    </section>
  );
}
