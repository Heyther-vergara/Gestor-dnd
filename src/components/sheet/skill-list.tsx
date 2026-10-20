import { abilityNames, formatModifier, skillNames } from "@/lib/format";
import type { ComputedSheet } from "@/rules-engine/engine";
import { skillSchema } from "@/rules-engine/schemas";

import { ProficiencyDot } from "./proficiency-dot";

// Las 18 habilidades en orden alfabético en español, en dos columnas desde
// tablet. Las competentes van en negrita para encontrarlas rápido.
export function SkillList({ skills }: Pick<ComputedSheet, "skills">) {
  const sorted = [...skillSchema.options].sort((a, b) =>
    skillNames[a].localeCompare(skillNames[b], "es"),
  );
  return (
    <ul className="grid gap-x-6 rounded-sm border border-border bg-card px-3 py-1 sm:grid-cols-2">
      {sorted.map((skill) => {
        const { ability, modifier, proficiency } = skills[skill];
        return (
          <li
            key={skill}
            className="flex items-center gap-2 border-b border-dashed border-border py-1.5 text-sm last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0"
          >
            <ProficiencyDot level={proficiency} />
            <span className={proficiency === "none" ? "" : "font-bold"}>
              {skillNames[skill]}
            </span>
            <span className="text-xs text-muted-foreground">
              ({abilityNames[ability].short})
            </span>
            <span className="ml-auto font-bold tabular-nums">
              {formatModifier(modifier)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
