import { SpellList } from "@/components/spells/spell-details";
import { abilityNames, formatModifier } from "@/lib/format";
import type { SpellcastingStats } from "@/rules-engine/engine";

import { type SpellSlotChange, SpellSlots } from "./spell-slots";

// CD, ataque, espacios y conjuros de cada clase que lanza conjuros.
// SRD 5.2.1, tabla "Rasgos de mago", "Espacios de conjuro por cada nivel de
// conjuro". Con `onSlotChange` los espacios se pueden gastar (ADR 0028).
// Los trucos, los preparados y el libro son las listas del personaje (ADR
// 0021); se cambian con el panel de la hoja, no aquí.
export function SpellcastingSummary({
  spellcasting,
  slotsDisabled,
  onSlotChange,
}: {
  spellcasting: SpellcastingStats[];
  slotsDisabled?: boolean;
  onSlotChange?: (
    classId: string,
    level: number,
    change: SpellSlotChange,
  ) => void;
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
          <SpellSlots
            stats={stats}
            disabled={slotsDisabled}
            onChange={
              onSlotChange &&
              ((level, change) => onSlotChange(stats.classId, level, change))
            }
          />
          {stats.limits.cantrips > 0 && (
            <SpellList
              title="Trucos"
              spells={stats.cantrips}
              max={stats.limits.cantrips}
              empty="Todavía no elegiste trucos."
            />
          )}
          {stats.limits.prepared > 0 && (
            <SpellList
              title="Conjuros preparados"
              spells={stats.prepared}
              max={stats.limits.prepared}
              empty="Todavía no preparaste conjuros."
            />
          )}
          {stats.spellbook && (
            <SpellList
              title="Todos los conjuros del libro"
              spells={stats.spellbook}
              max={stats.limits.spellbook ?? undefined}
              empty="El libro está vacío."
            />
          )}
        </div>
      ))}
    </div>
  );
}
