import { abilityNames, formatModifier } from "@/lib/format";
import type { SpellcastingStats } from "@/rules-engine/engine";

// CD, ataque y espacios de conjuro de cada clase que lanza conjuros.
// SRD 5.2.1, tabla "Rasgos de mago", "Espacios de conjuro por cada nivel de
// conjuro". Contar los espacios gastados queda para la fase 5 (partida).
export function SpellcastingSummary({
  spellcasting,
}: {
  spellcasting: SpellcastingStats[];
}) {
  return (
    <div className="grid gap-3">
      {spellcasting.map((stats) => (
        <div key={stats.classId} className="grid gap-2">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
            <span>
              Aptitud{" "}
              <b className="text-foreground">
                {abilityNames[stats.ability].name}
              </b>
            </span>
            <span>
              CD de salvación <b className="text-foreground">{stats.saveDc}</b>
            </span>
            <span>
              Ataque{" "}
              <b className="text-foreground">
                {formatModifier(stats.attackBonus)}
              </b>
            </span>
          </p>
          {stats.slots.length > 0 && (
            <dl className="flex flex-wrap gap-2">
              {stats.slots.map((count, i) => (
                <div
                  key={i}
                  className="grid min-w-16 justify-items-center rounded-lg border border-border bg-card px-3 py-2"
                >
                  <dt className="text-xs text-muted-foreground">
                    Nivel {i + 1}
                  </dt>
                  <dd className="font-heading text-xl font-bold tabular-nums">
                    {count}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </div>
  );
}
