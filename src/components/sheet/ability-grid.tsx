import { abilityNames, formatModifier } from "@/lib/format";
import type { ComputedSheet } from "@/rules-engine/engine";
import { abilitySchema } from "@/rules-engine/schemas";

import { ProficiencyDot } from "./proficiency-dot";

// Las seis características: modificador grande, puntuación chica y debajo
// la tirada de salvación, con la marca de competencia.
export function AbilityGrid({
  abilities,
  savingThrows,
}: Pick<ComputedSheet, "abilities" | "savingThrows">) {
  return (
    <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
      {abilitySchema.options.map((ability) => {
        const { score, modifier } = abilities[ability];
        const save = savingThrows[ability];
        return (
          <li
            key={ability}
            className="grid gap-0.5 rounded-sm border border-border bg-card px-1 py-2 text-center"
          >
            <abbr
              title={abilityNames[ability].name}
              className="text-[0.7rem] font-semibold tracking-wider text-muted-foreground uppercase no-underline"
            >
              {abilityNames[ability].short}
            </abbr>
            <span className="text-2xl leading-tight font-bold tabular-nums">
              {formatModifier(modifier)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {score}
            </span>
            <span className="mt-1 flex items-center justify-center gap-1 border-t border-border pt-1 text-xs tabular-nums">
              <ProficiencyDot level={save.proficient ? "proficient" : "none"} />
              Salv. {formatModifier(save.modifier)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
