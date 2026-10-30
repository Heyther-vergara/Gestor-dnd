import type { ReactNode } from "react";

import { damageTypeNames, feetToMeters } from "@/lib/format";
import type { ComputedSheet } from "@/rules-engine/engine";

import { AbilityGrid } from "./ability-grid";
import { ArmorWarnings } from "./armor-warnings";
import { HitPoints } from "./hit-points";
import { SheetSection } from "./sheet-section";
import { SkillList } from "./skill-list";
import { VitalsRow } from "./vitals-row";

// La hoja completa. Recibe la hoja ya calculada: este componente no conoce
// reglas, solo las muestra. `playPanel` son los controles de partida, si los hay.
export function SheetView({
  name,
  subtitle,
  sheet,
  playPanel,
}: {
  name: string;
  subtitle: string;
  sheet: ComputedSheet;
  playPanel?: ReactNode;
}) {
  return (
    <article className="mx-auto grid w-full max-w-2xl gap-5 px-4 py-6">
      <header className="grid gap-0.5">
        <h1 className="font-heading text-3xl leading-tight font-bold tracking-wide text-balance">
          {name}
        </h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </header>

      <VitalsRow sheet={sheet} />
      <HitPoints hitPoints={sheet.hitPoints} hitDice={sheet.hitDice} />
      {playPanel}
      <ArmorWarnings penalties={sheet.armorPenalties} />

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
        <span>
          Percepción pasiva{" "}
          <b className="text-foreground">{sheet.passivePerception}</b>
        </span>
        {sheet.darkvision > 0 && (
          <span>
            Visión en la oscuridad{" "}
            <b className="text-foreground">{feetToMeters(sheet.darkvision)}</b>
          </span>
        )}
        {defenseLines(sheet.damageDefenses).map(({ label, types }) => (
          <span key={label}>
            {label} <b className="text-foreground">{types}</b>
          </span>
        ))}
      </p>

      <SheetSection title="Características">
        <AbilityGrid
          abilities={sheet.abilities}
          savingThrows={sheet.savingThrows}
        />
      </SheetSection>

      <SheetSection title="Habilidades">
        <SkillList skills={sheet.skills} />
      </SheetSection>
    </article>
  );
}

// "Resistencia veneno, fuego": solo las defensas que el personaje tiene.
function defenseLines(defenses: ComputedSheet["damageDefenses"]) {
  return [
    { label: "Resistencia", list: defenses.resistances },
    { label: "Vulnerabilidad", list: defenses.vulnerabilities },
    { label: "Inmunidad", list: defenses.immunities },
  ]
    .filter(({ list }) => list.length > 0)
    .map(({ label, list }) => ({
      label,
      types: list.map((type) => damageTypeNames[type]).join(", "),
    }));
}
