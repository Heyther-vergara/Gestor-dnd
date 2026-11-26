import type { ReactNode } from "react";

import {
  abilityNames,
  damageTypeNames,
  feetToMeters,
  formatModifier,
  type inventoryLines,
} from "@/lib/format";
import type { ComputedSheet } from "@/rules-engine/engine";

import { AbilityGrid } from "./ability-grid";
import { ArmorWarnings } from "./armor-warnings";
import { EquipmentList } from "./equipment-list";
import { FeatureList } from "./feature-list";
import { Foldout } from "./foldout";
import { HitPoints } from "./hit-points";
import { SheetHeader } from "./sheet-header";
import { SheetSection } from "./sheet-section";
import { SkillList } from "./skill-list";
import { SpellcastingSummary } from "./spellcasting-summary";
import { VitalsRow } from "./vitals-row";

// La hoja completa. Recibe la hoja ya calculada: este componente no conoce
// reglas, solo las muestra. `playPanel` son los controles de partida, si los hay.
// `equipment` es el inventario y las monedas ya en texto (no son valores
// calculados: los guarda el personaje). `homebrewPanel` es para darle o
// sacarle objetos homebrew (ADR 0019). `resourcePanel` es para gastar los
// recursos de clase (ADR 0020); sin él, solo se muestran los números.
// `spellPanel` es para preparar y cambiar conjuros (ADR 0021).
export function SheetView({
  name,
  subtitle,
  sheet,
  playPanel,
  equipment,
  homebrewPanel,
  resourcePanel,
  spellPanel,
}: {
  name: string;
  subtitle: string;
  sheet: ComputedSheet;
  playPanel?: ReactNode;
  equipment?: { items: ReturnType<typeof inventoryLines>; coins: string };
  homebrewPanel?: ReactNode;
  resourcePanel?: ReactNode;
  spellPanel?: ReactNode;
}) {
  const spellSummary = spellcastingLine(sheet.spellcasting);
  const itemCount = equipment?.items.length ?? 0;

  return (
    <article className="mx-auto grid w-full max-w-2xl gap-5 px-4 pb-6 lg:max-w-6xl">
      <SheetHeader
        name={name}
        subtitle={subtitle}
        hitPoints={sheet.hitPoints}
        ac={sheet.ac}
      />

      {/* En el celular todo va en una columna. Desde 1024 px (lg) hay espacio
          para dos: a la izquierda lo de combate, a la derecha lo que se
          consulta (conjuros, equipo, rasgos) en desplegables. */}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start lg:gap-8">
        <div className="grid min-w-0 gap-5">
          <VitalsRow sheet={sheet} />
          <HitPoints hitPoints={sheet.hitPoints} hitDice={sheet.hitDice} />
          {playPanel}
          <ArmorWarnings penalties={sheet.armorPenalties} />
          {sheet.exhaustion.level > 0 && (
            <p className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Cansancio nivel {sheet.exhaustion.level}: −
              {sheet.exhaustion.d20Penalty} a las pruebas con d20 y −
              {feetToMeters(sheet.exhaustion.speedPenalty)} de velocidad. Ya
              está restado en la hoja.
            </p>
          )}

          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
            <span>
              Percepción pasiva{" "}
              <b className="text-foreground">{sheet.passivePerception}</b>
            </span>
            {sheet.darkvision > 0 && (
              <span>
                Visión en la oscuridad{" "}
                <b className="text-foreground">
                  {feetToMeters(sheet.darkvision)}
                </b>
              </span>
            )}
            {sheet.toolProficiencies.length > 0 && (
              <span>
                Herramientas{" "}
                <b className="text-foreground">
                  {sheet.toolProficiencies.join(", ")}
                </b>
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
        </div>

        <div className="grid min-w-0 gap-5">
          {(sheet.resources.length > 0 || sheet.saveDcs.length > 0) && (
            <SheetSection title="Recursos de clase">
              <div className="grid gap-3">
                {sheet.saveDcs.length > 0 && (
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
                    {sheet.saveDcs.map((dc) => (
                      <span key={`${dc.classId}-${dc.name}`}>
                        {dc.name} <b className="text-foreground">{dc.value}</b>{" "}
                        ({abilityNames[dc.ability].short})
                      </span>
                    ))}
                  </p>
                )}
                {resourcePanel ??
                  (sheet.resources.length > 0 && (
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground tabular-nums">
                      {sheet.resources.map((r) => (
                        <span key={r.id}>
                          {r.name}{" "}
                          <b className="text-foreground">
                            {r.remaining} de {r.max}
                          </b>
                        </span>
                      ))}
                    </p>
                  ))}
              </div>
            </SheetSection>
          )}

          {sheet.spellcasting.length > 0 && (
            <Foldout title="Libro de conjuros" summary={spellSummary}>
              <SpellcastingSummary spellcasting={sheet.spellcasting} />
              {spellPanel}
            </Foldout>
          )}

          {equipment && (
            <Foldout
              title="Equipo"
              summary={equipmentLine(itemCount, equipment.coins)}
            >
              <EquipmentList items={equipment.items} coins={equipment.coins} />
              {homebrewPanel && (
                <div className="grid gap-2 border-t border-border pt-3">
                  <h3 className="font-medium">Objetos homebrew</h3>
                  {homebrewPanel}
                </div>
              )}
            </Foldout>
          )}

          {!equipment && homebrewPanel && (
            <Foldout title="Objetos homebrew">{homebrewPanel}</Foldout>
          )}

          {sheet.features.length > 0 && (
            <Foldout
              title="Rasgos"
              summary={
                sheet.features.length === 1
                  ? "1 rasgo"
                  : `${sheet.features.length} rasgos`
              }
            >
              <FeatureList features={sheet.features} />
            </Foldout>
          )}
        </div>
      </div>
    </article>
  );
}

// Lo que se ve con el libro cerrado: "CD 13 · Ataque +5 · Espacios 4·2".
// Con varias clases lanzadoras, una parte por clase separada con " | ".
function spellcastingLine(spellcasting: ComputedSheet["spellcasting"]) {
  return spellcasting
    .map((stats) => {
      const parts = [
        `CD ${stats.saveDc}`,
        `Ataque ${formatModifier(stats.attackBonus)}`,
      ];
      if (stats.slots.length > 0) {
        parts.push(`Espacios ${stats.slots.join("·")}`);
      }
      return parts.join(" · ");
    })
    .join(" | ");
}

// "12 objetos · 18 po", o solo una de las dos partes si falta la otra.
function equipmentLine(itemCount: number, coins: string) {
  const parts: string[] = [];
  if (itemCount > 0) {
    parts.push(itemCount === 1 ? "1 objeto" : `${itemCount} objetos`);
  }
  if (coins !== "") parts.push(coins);
  return parts.length > 0 ? parts.join(" · ") : "Sin equipo";
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
