import type { SpellcastingStats } from "@/rules-engine/engine";

export type SpellSlotChange = "spend" | "recover";

// Los espacios de conjuro de una clase, un círculo por espacio (ADR 0028).
// Lleno = disponible, vacío = gastado. Con `onChange`, tocar uno lleno lo
// gasta y tocar uno vacío lo devuelve (para corregir un toque equivocado).
// Sin `onChange` (hoja de solo lectura), los círculos no son botones.
export function SpellSlots({
  stats,
  disabled = false,
  onChange,
}: {
  stats: SpellcastingStats;
  disabled?: boolean;
  onChange?: (level: number, change: SpellSlotChange) => void;
}) {
  if (stats.slots.length === 0) return null;
  return (
    <div className="grid gap-1">
      <h3 className="font-medium">Espacios de conjuro</h3>
      {onChange && (
        <p className="text-xs text-muted-foreground">
          Toca un círculo lleno para gastarlo; uno vacío lo recupera.
        </p>
      )}
      <dl className="grid gap-1">
        {stats.slots.map((max, i) => {
          const level = i + 1;
          const remaining = stats.slotsRemaining[i] ?? 0;
          return (
            <div key={level} className="flex items-center gap-3 text-sm">
              <dt className="w-16 shrink-0 text-muted-foreground">
                Nivel {level}
              </dt>
              <dd className="flex flex-wrap items-center gap-0.5">
                {Array.from({ length: max }, (_, slot) => {
                  const available = slot < remaining;
                  const pip = (
                    <span
                      aria-hidden="true"
                      className={
                        available
                          ? "block size-3.5 rounded-full border-2 border-gold bg-gold/80"
                          : "block size-3.5 rounded-full border-2 border-gold/60"
                      }
                    />
                  );
                  if (!onChange) {
                    return (
                      <span key={slot} className="p-1">
                        {pip}
                      </span>
                    );
                  }
                  // Botón de 24 px aunque el círculo mida 14: así es fácil
                  // de tocar con el dedo (WCAG 2.5.8, tamaño mínimo).
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onChange(level, available ? "spend" : "recover")
                      }
                      aria-label={
                        available
                          ? `Gastar un espacio de nivel ${level}`
                          : `Recuperar un espacio de nivel ${level}`
                      }
                      className="grid size-6 place-items-center rounded-full outline-ring hover:bg-gold/15 focus-visible:outline-2 disabled:opacity-50"
                    >
                      {pip}
                    </button>
                  );
                })}
                <span className="ml-1 text-muted-foreground tabular-nums">
                  {remaining} de {max}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
