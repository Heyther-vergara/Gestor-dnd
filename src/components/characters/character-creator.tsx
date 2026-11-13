"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { Fieldset, Option } from "@/components/characters/choice-fields";
import { AbilityGrid } from "@/components/sheet/ability-grid";
import { EquipmentList } from "@/components/sheet/equipment-list";
import { VitalsRow } from "@/components/sheet/vitals-row";
import { Button } from "@/components/ui/button";
import {
  ABILITIES,
  type AbilityBonusPlan,
  BUILDER_STEPS,
  type BuilderStep,
  buildCharacter,
  builderOptions,
  type CharacterDraft,
  draftErrors,
  emptyDraft,
  emptyEquipmentChoice,
  type EquipmentChoice,
  MAX_NAME_LENGTH,
  overlappingSkills,
  STANDARD_ARRAY,
  suggestedAbilityScores,
} from "@/lib/character-builder";
import { toSavedCharacter, writeSavedCharacter } from "@/lib/character-storage";
import {
  abilityNames,
  characterSubtitle,
  coinsText,
  contentName,
  contentNameById,
  equipmentOptionText,
  feetToMeters,
  inventoryLines,
  optionLetter,
  sizeNames,
  skillNames,
} from "@/lib/format";
import { srd2024Index } from "@/lib/srd-2024";
import { getCharacterStore } from "@/lib/supabase/character-store";
import { calculateSheet } from "@/rules-engine/engine";
import type {
  Ability,
  Skill,
  StartingEquipmentOption,
} from "@/rules-engine/schemas";

const options = builderOptions(srd2024Index);

// Los pasos del formulario más el resumen final.
type Step = BuilderStep | "summary";
const STEPS: readonly Step[] = [...BUILDER_STEPS, "summary"];

const stepTitles: Record<Step, string> = {
  name: "Nombre",
  species: "Especie",
  class: "Clase",
  background: "Trasfondo",
  abilities: "Características",
  equipment: "Equipo",
  summary: "Resumen",
};

// Mismo estilo que los inputs de shadcn.
const inputClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

// Creador de personajes de nivel 1, un paso por pantalla (ADR 0015). Todas
// las reglas están en `lib/character-builder`: este componente solo guarda el
// borrador, muestra los errores que devuelve y, al final, guarda el personaje.
export function CharacterCreator() {
  const router = useRouter();
  const [draft, setDraft] = useState<CharacterDraft>(emptyDraft);
  const [stepIndex, setStepIndex] = useState(0);
  // Se muestra el error de un paso recién después de intentar avanzar.
  const [showError, setShowError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const step = STEPS[stepIndex] ?? "summary";
  const errors = useMemo(() => draftErrors(draft, srd2024Index), [draft]);
  const stepError = step === "summary" ? undefined : errors[step];

  const update = (patch: Partial<CharacterDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  function goNext() {
    if (stepError) {
      setShowError(true);
      return;
    }
    setShowError(false);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  }

  function goBack() {
    setShowError(false);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function create() {
    const result = buildCharacter(draft, srd2024Index, crypto.randomUUID());
    if (!result.ok) {
      // No debería pasar (cada paso se valida al avanzar), pero si pasa se
      // vuelve al primer paso con problemas.
      const first = BUILDER_STEPS.findIndex((s) => result.errors[s]);
      setStepIndex(Math.max(first, 0));
      setShowError(true);
      return;
    }

    setSaving(true);
    setSaveError(false);
    // El mismo sobre en los dos lados, con la misma fecha.
    const saved = toSavedCharacter(result.character);
    let savedSomewhere = false;
    try {
      writeSavedCharacter(window.localStorage, saved);
      savedSomewhere = true;
    } catch {
      // Navegador sin almacenamiento: queda la nube.
    }
    const store = getCharacterStore();
    if (store) {
      try {
        await store.save(saved);
        savedSomewhere = true;
      } catch {
        // Sin conexión: la copia del navegador se sube al abrir la hoja.
      }
    }

    if (!savedSomewhere) {
      setSaving(false);
      setSaveError(true);
      return;
    }
    router.push(`/characters/${result.character.id}`);
  }

  return (
    <div className="grid gap-5">
      <ol className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {STEPS.map((s, i) => (
          <li
            key={s}
            aria-current={i === stepIndex ? "step" : undefined}
            className={i === stepIndex ? "font-medium text-primary" : ""}
          >
            {i + 1}. {stepTitles[s]}
          </li>
        ))}
      </ol>

      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === "summary") void create();
          else goNext();
        }}
      >
        {step === "name" && <NameStep draft={draft} update={update} />}
        {step === "species" && <SpeciesStep draft={draft} update={update} />}
        {step === "class" && <ClassStep draft={draft} update={update} />}
        {step === "background" && (
          <BackgroundStep draft={draft} update={update} />
        )}
        {step === "abilities" && (
          <AbilitiesStep draft={draft} update={update} />
        )}
        {step === "equipment" && (
          <EquipmentStep draft={draft} update={update} />
        )}
        {step === "summary" && <SummaryStep draft={draft} />}

        <p
          className="min-h-5 text-sm text-destructive"
          role="alert"
          aria-live="assertive"
        >
          {showError && stepError}
          {saveError &&
            "No se pudo guardar el personaje. Probá de nuevo en un rato."}
        </p>

        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={stepIndex === 0 || saving}
          >
            Atrás
          </Button>
          <Button type="submit" disabled={saving}>
            {step === "summary"
              ? saving
                ? "Guardando…"
                : "Crear personaje"
              : "Siguiente"}
          </Button>
        </div>
      </form>
    </div>
  );
}

type StepProps = {
  draft: CharacterDraft;
  update: (patch: Partial<CharacterDraft>) => void;
};

function NameStep({ draft, update }: StepProps) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <label
        htmlFor={id}
        className="font-heading text-lg font-bold text-primary"
      >
        ¿Cómo se llama tu personaje?
      </label>
      <input
        id={id}
        className={inputClass}
        value={draft.name}
        maxLength={MAX_NAME_LENGTH}
        autoComplete="off"
        autoFocus
        onChange={(e) => update({ name: e.target.value })}
      />
    </div>
  );
}

function SpeciesStep({ draft, update }: StepProps) {
  const species = options.species.find((s) => s.id === draft.speciesId);
  return (
    <>
      <Fieldset legend="Elegí una especie">
        {options.species.map((s) => (
          <Option
            key={s.id}
            type="radio"
            name="species"
            checked={draft.speciesId === s.id}
            // Si la especie tiene un solo tamaño no hay nada que elegir.
            onChange={() =>
              update({
                speciesId: s.id,
                size: s.data.size.length === 1 ? null : draft.size,
              })
            }
            title={contentName(s)}
            detail={`${s.data.size.map((z) => sizeNames[z]).join(" o ")} · velocidad ${feetToMeters(s.data.speed)}`}
          />
        ))}
      </Fieldset>
      {species && species.data.size.length > 1 && (
        <Fieldset legend="Tamaño">
          {species.data.size.map((size) => (
            <Option
              key={size}
              type="radio"
              name="size"
              checked={draft.size === size}
              onChange={() => update({ size })}
              title={sizeNames[size]}
            />
          ))}
        </Fieldset>
      )}
    </>
  );
}

function ClassStep({ draft, update }: StepProps) {
  const cls = options.classes.find((c) => c.id === draft.classId);
  const { count, options: skillOptions } = cls?.data.skillChoices ?? {
    count: 0,
    options: [],
  };

  function toggleSkill(skill: Skill) {
    update({
      classSkills: draft.classSkills.includes(skill)
        ? draft.classSkills.filter((s) => s !== skill)
        : [...draft.classSkills, skill],
    });
  }

  return (
    <>
      <Fieldset legend="Elegí una clase">
        {options.classes.map((c) => (
          <Option
            key={c.id}
            type="radio"
            name="class"
            checked={draft.classId === c.id}
            // Las habilidades y el equipo son de cada clase: al cambiar,
            // se vacían.
            onChange={() =>
              c.id !== draft.classId &&
              update({
                classId: c.id,
                classSkills: [],
                classEquipment: emptyEquipmentChoice(),
              })
            }
            title={contentName(c)}
            detail={`Dado de golpe d${c.data.hitDie} · característica principal: ${c.data.primaryAbilities.map((a) => abilityNames[a].name).join(" o ")}`}
          />
        ))}
      </Fieldset>
      {cls && (
        <Fieldset
          legend={`Habilidades (elegí ${count})`}
          hint={`${draft.classSkills.length} de ${count} elegidas.`}
        >
          <div className="grid grid-cols-2 gap-2">
            {skillOptions.map((skill) => {
              const checked = draft.classSkills.includes(skill);
              return (
                <Option
                  key={skill}
                  type="checkbox"
                  name="skills"
                  checked={checked}
                  disabled={!checked && draft.classSkills.length >= count}
                  onChange={() => toggleSkill(skill)}
                  title={skillNames[skill]}
                />
              );
            })}
          </div>
        </Fieldset>
      )}
    </>
  );
}

function BackgroundStep({ draft, update }: StepProps) {
  const background = options.backgrounds.find(
    (b) => b.id === draft.backgroundId,
  );
  const plan = draft.abilityBonus;
  const setPlan = (abilityBonus: AbilityBonusPlan) => update({ abilityBonus });

  return (
    <>
      <Fieldset legend="Elegí un trasfondo">
        {options.backgrounds.map((b) => (
          <Option
            key={b.id}
            type="radio"
            name="background"
            checked={draft.backgroundId === b.id}
            // Las características que se pueden subir y el equipo son de
            // cada trasfondo.
            onChange={() =>
              b.id !== draft.backgroundId &&
              update({
                backgroundId: b.id,
                abilityBonus: { mode: "two-one", plusTwo: null, plusOne: null },
                backgroundEquipment: emptyEquipmentChoice(),
              })
            }
            title={contentName(b)}
            detail={`Habilidades: ${b.data.skillProficiencies.map((s) => skillNames[s]).join(" y ")} · sube ${b.data.abilityOptions.map((a) => abilityNames[a].short).join(", ")}`}
          />
        ))}
      </Fieldset>

      {background && (
        <Fieldset
          legend="Aumentos de característica"
          hint="Subí una en 2 y otra en 1, o las tres en 1."
        >
          <div className="grid grid-cols-2 gap-2">
            <Option
              type="radio"
              name="bonus-mode"
              checked={plan.mode === "two-one"}
              onChange={() =>
                plan.mode !== "two-one" &&
                setPlan({ mode: "two-one", plusTwo: null, plusOne: null })
              }
              title="+2 y +1"
            />
            <Option
              type="radio"
              name="bonus-mode"
              checked={plan.mode === "one-one-one"}
              onChange={() => setPlan({ mode: "one-one-one" })}
              title="+1 a las tres"
            />
          </div>
          {plan.mode === "two-one" && (
            <div className="grid grid-cols-2 gap-2">
              <AbilitySelect
                label="+2 a"
                value={plan.plusTwo}
                choices={background.data.abilityOptions}
                onChange={(plusTwo) =>
                  setPlan({
                    ...plan,
                    plusTwo,
                    plusOne: plan.plusOne === plusTwo ? null : plan.plusOne,
                  })
                }
              />
              <AbilitySelect
                label="+1 a"
                value={plan.plusOne}
                choices={background.data.abilityOptions.filter(
                  (a) => a !== plan.plusTwo,
                )}
                onChange={(plusOne) => setPlan({ ...plan, plusOne })}
              />
            </div>
          )}
        </Fieldset>
      )}
    </>
  );
}

function AbilitySelect({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: Ability | null;
  choices: readonly Ability[];
  onChange: (ability: Ability) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className={inputClass}
        value={value ?? ""}
        onChange={(e) => {
          const ability = choices.find((a) => a === e.target.value);
          if (ability) onChange(ability);
        }}
      >
        <option value="" disabled>
          Elegí…
        </option>
        {choices.map((a) => (
          <option key={a} value={a}>
            {abilityNames[a].name}
          </option>
        ))}
      </select>
    </div>
  );
}

function AbilitiesStep({ draft, update }: StepProps) {
  const suggested = suggestedAbilityScores(draft.classId);
  const scores = draft.baseAbilityScores;
  const used = ABILITIES.map((a) => scores[a]).filter((v) => v !== null);

  // Al elegir un número que ya usa otra característica, se intercambian:
  // así nunca quedan dos iguales.
  function assign(ability: Ability, value: number) {
    const next = { ...scores };
    const holder = ABILITIES.find((a) => a !== ability && next[a] === value);
    if (holder) next[holder] = next[ability];
    next[ability] = value;
    update({ baseAbilityScores: next });
  }

  return (
    <Fieldset
      legend="Características"
      hint="Repartí el conjunto estándar: 15, 14, 13, 12, 10 y 8, cada número una vez. Los aumentos del trasfondo se suman después."
    >
      {suggested && (
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() => update({ baseAbilityScores: suggested })}
        >
          Usar el reparto sugerido para la clase
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ABILITIES.map((ability) => (
          <ScoreSelect
            key={ability}
            ability={ability}
            value={scores[ability]}
            used={used}
            onChange={(value) => assign(ability, value)}
          />
        ))}
      </div>
    </Fieldset>
  );
}

function ScoreSelect({
  ability,
  value,
  used,
  onChange,
}: {
  ability: Ability;
  value: number | null;
  used: number[];
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {abilityNames[ability].name}
      </label>
      <select
        id={id}
        className={`${inputClass} tabular-nums`}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        <option value="" disabled>
          —
        </option>
        {STANDARD_ARRAY.map((n) => (
          <option key={n} value={n}>
            {n}
            {n !== value && used.includes(n) ? " (cambiar)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// SRD 5.2.1, "Elige el equipo inicial": una opción de la clase y una del
// trasfondo (ADR 0017).
function EquipmentStep({ draft, update }: StepProps) {
  const cls = options.classes.find((c) => c.id === draft.classId);
  const background = options.backgrounds.find(
    (b) => b.id === draft.backgroundId,
  );
  return (
    <>
      {cls && (
        <EquipmentOptions
          legend={`Equipo de ${contentName(cls)}`}
          name="class-equipment"
          options={cls.data.startingEquipment}
          choice={draft.classEquipment}
          onChange={(classEquipment) => update({ classEquipment })}
        />
      )}
      {background && (
        <EquipmentOptions
          legend={`Equipo de ${contentName(background)}`}
          name="background-equipment"
          options={background.data.startingEquipment}
          choice={draft.backgroundEquipment}
          onChange={(backgroundEquipment) => update({ backgroundEquipment })}
        />
      )}
      <p className="text-sm text-muted-foreground">
        La armadura y el escudo quedan equipados. Las monedas se guardan en la
        hoja para comprar más adelante.
      </p>
    </>
  );
}

function EquipmentOptions({
  legend,
  name,
  options: equipmentOptions,
  choice,
  onChange,
}: {
  legend: string;
  name: string;
  options: readonly StartingEquipmentOption[];
  choice: EquipmentChoice;
  onChange: (choice: EquipmentChoice) => void;
}) {
  if (equipmentOptions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {legend}: no da equipo inicial.
      </p>
    );
  }
  const chosen =
    choice.option === null ? undefined : equipmentOptions[choice.option];
  return (
    <Fieldset legend={legend}>
      {equipmentOptions.map((option, i) => (
        <Option
          key={i}
          type="radio"
          name={name}
          checked={choice.option === i}
          // Las elecciones de "elegí uno" son de cada opción.
          onChange={() =>
            choice.option !== i && onChange({ option: i, picks: [] })
          }
          title={`Opción ${optionLetter(i)}`}
          detail={equipmentOptionText(option, srd2024Index)}
        />
      ))}
      {chosen?.items.map((entry, i) =>
        entry.itemIds.length > 1 ? (
          <ItemSelect
            key={i}
            label="Elegí uno"
            value={choice.picks[i] ?? null}
            itemIds={entry.itemIds}
            onChange={(itemId) => {
              const picks = [...choice.picks];
              picks[i] = itemId;
              onChange({ ...choice, picks });
            }}
          />
        ) : null,
      )}
    </Fieldset>
  );
}

function ItemSelect({
  label,
  value,
  itemIds,
  onChange,
}: {
  label: string;
  value: string | null;
  itemIds: readonly string[];
  onChange: (itemId: string) => void;
}) {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        className={inputClass}
        value={value ?? ""}
        onChange={(e) => {
          const itemId = itemIds.find((i) => i === e.target.value);
          if (itemId) onChange(itemId);
        }}
      >
        <option value="" disabled>
          Elegí…
        </option>
        {itemIds.map((itemId) => (
          <option key={itemId} value={itemId}>
            {contentNameById(itemId, srd2024Index)}
          </option>
        ))}
      </select>
    </div>
  );
}

function SummaryStep({ draft }: { draft: CharacterDraft }) {
  // El id es provisorio: es solo para mostrar la hoja antes de guardar.
  const result = buildCharacter(draft, srd2024Index, "preview");
  if (!result.ok) return null;
  const sheet = calculateSheet(result.character, srd2024Index);
  const overlap = overlappingSkills(draft, srd2024Index);

  return (
    <section className="grid gap-4" aria-label="Resumen del personaje">
      <header className="grid gap-0.5">
        <h2 className="font-heading text-2xl font-bold">
          {result.character.name}
        </h2>
        <p className="text-muted-foreground">
          {characterSubtitle(result.character, srd2024Index)}
        </p>
      </header>
      <VitalsRow sheet={sheet} />
      <p className="text-sm text-muted-foreground tabular-nums">
        Puntos de golpe <b className="text-foreground">{sheet.hitPoints.max}</b>
      </p>
      <AbilityGrid
        abilities={sheet.abilities}
        savingThrows={sheet.savingThrows}
      />
      {overlap.length > 0 && (
        <p className="rounded-sm border border-gold/40 bg-gold/10 p-3 text-sm">
          {overlap.map((s) => skillNames[s]).join(" y ")} ya{" "}
          {overlap.length === 1 ? "la da" : "las da"} el trasfondo: elegir{" "}
          {overlap.length === 1 ? "esa habilidad" : "esas habilidades"} en la
          clase no suma nada. Podés volver al paso Clase y cambiar.
        </p>
      )}
      <EquipmentList
        items={inventoryLines(result.character.inventory, srd2024Index)}
        coins={coinsText(result.character.coins)}
      />
      <p className="text-sm text-muted-foreground">
        Todavía no se eligen la dote del trasfondo ni los conjuros: los podés
        anotar aparte por ahora.
      </p>
    </section>
  );
}
