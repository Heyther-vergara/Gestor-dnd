// Una casilla de la hoja: etiqueta chica arriba y número grande abajo.
// El borde doble imita el marco de una ficha de papel (ADR 0008).
export function StatBox({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="grid gap-0.5 rounded-sm border border-border bg-card px-1 py-2 text-center shadow-[inset_0_0_0_3px_var(--card),inset_0_0_0_4px_var(--border)]">
      <span className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <span className="text-2xl leading-tight font-bold tabular-nums">
        {value}
      </span>
      {detail && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {detail}
        </span>
      )}
    </div>
  );
}
