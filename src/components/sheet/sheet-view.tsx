import { feetToMeters } from "@/lib/format";
import type { ComputedSheet } from "@/rules-engine/engine";

import { AbilityGrid } from "./ability-grid";
import { ArmorWarnings } from "./armor-warnings";
import { HitPoints } from "./hit-points";
import { SheetSection } from "./sheet-section";
import { SkillList } from "./skill-list";
import { VitalsRow } from "./vitals-row";

// La hoja completa, solo lectura. Recibe la hoja ya calculada: este
// componente no conoce reglas, solo las muestra.
export function SheetView({
  name,
  subtitle,
  sheet,
}: {
  name: string;
  subtitle: string;
  sheet: ComputedSheet;
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
