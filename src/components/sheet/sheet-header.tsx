import type { ComputedSheet } from "@/rules-engine/engine";

// Cabecera de la hoja: nombre, subtítulo y, a la derecha, los PG y la CA.
// Queda fija arriba al bajar (sticky), así los dos números que más cambian
// o se consultan en combate siempre están a la vista, también en el celular.
export function SheetHeader({
  name,
  subtitle,
  hitPoints,
  ac,
}: {
  name: string;
  subtitle: string;
  hitPoints: ComputedSheet["hitPoints"];
  ac: number;
}) {
  const { current, max, temp } = hitPoints;
  const percent = max > 0 ? Math.round((current / max) * 100) : 0;
  // Mismo umbral que HitPoints: debajo de la mitad la barra pasa a rojo.
  const low = current * 2 < max;

  return (
    <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/85">
      <div className="flex items-center gap-3">
        <div className="grid min-w-0 flex-1">
          <h1 className="truncate font-heading text-2xl leading-tight font-bold tracking-wide sm:text-3xl">
            {name}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {/* Resumen visual: los números completos están en VitalsRow y
            HitPoints, más abajo. */}
        <div className="grid w-24 shrink-0 gap-1 sm:w-32" aria-hidden="true">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground tabular-nums">
            <span className="font-semibold tracking-wider uppercase">PG</span>
            <span>
              <b className="text-base text-foreground">{current}</b>/{max}
              {temp > 0 && <span className="text-gold"> +{temp}</span>}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={low ? "h-full bg-destructive" : "h-full bg-success"}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <div
          className="grid shrink-0 justify-items-center rounded-sm border border-border bg-card px-2 py-0.5"
          aria-hidden="true"
        >
          <span className="text-[0.6rem] font-semibold tracking-wider text-muted-foreground uppercase">
            CA
          </span>
          <span className="text-lg leading-tight font-bold tabular-nums">
            {ac}
          </span>
        </div>
      </div>
    </header>
  );
}
