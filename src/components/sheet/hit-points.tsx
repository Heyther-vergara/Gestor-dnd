import type { ComputedSheet } from "@/rules-engine/engine";

// PG actuales sobre máximos, con barra. Por ahora solo lectura: los botones
// de daño y curación llegan cuando la hoja se pueda editar.
export function HitPoints({
  hitPoints,
  hitDice,
}: Pick<ComputedSheet, "hitPoints" | "hitDice">) {
  const { current, max, temp } = hitPoints;
  const percent = max > 0 ? Math.round((current / max) * 100) : 0;
  // Debajo de la mitad (el "malherido" de muchas mesas) la barra pasa a rojo.
  const low = current * 2 < max;
  const dice = Object.entries(hitDice.byDie)
    .map(([die, count]) => `${count}${die}`)
    .join(" + ");

  return (
    <div className="grid gap-2 rounded-sm border border-border bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
          Puntos de golpe
        </span>
        <span className="tabular-nums">
          <span className="text-2xl font-bold">{current}</span>
          <span className="text-muted-foreground"> / {max}</span>
          {temp > 0 && <span className="text-gold"> +{temp} temp.</span>}
        </span>
      </div>
      <div
        role="meter"
        aria-label="Puntos de golpe"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={low ? "h-full bg-destructive" : "h-full bg-success"}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        Dados de golpe: {hitDice.remaining} de {hitDice.total} ({dice})
      </p>
    </div>
  );
}
