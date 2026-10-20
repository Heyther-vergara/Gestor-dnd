import { feetToMeters, formatModifier } from "@/lib/format";
import type { ComputedSheet } from "@/rules-engine/engine";

import { StatBox } from "./stat-box";

// Los cuatro números que más se miran en combate.
export function VitalsRow({ sheet }: { sheet: ComputedSheet }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <StatBox label="CA" value={String(sheet.ac)} />
      <StatBox label="Inic." value={formatModifier(sheet.initiative)} />
      <StatBox label="Veloc." value={feetToMeters(sheet.speed)} />
      <StatBox label="Comp." value={formatModifier(sheet.proficiencyBonus)} />
    </div>
  );
}
