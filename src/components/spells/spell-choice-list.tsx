import { Fieldset } from "@/components/characters/choice-fields";
import { spellLevelText, spellSummary } from "@/lib/format";
import type { SpellContent } from "@/rules-engine/engine";

import { SpellBody } from "./spell-details";

// Elegir hasta `max` conjuros de una lista (ADR 0021). La usan el creador,
// subir de nivel y la hoja. Las opciones van agrupadas por nivel; con la
// lista llena, las que no están marcadas se desactivan.
export function SpellChoiceList({
  legend,
  hint,
  name,
  spells,
  selected,
  max,
  onToggle,
  disabled = false,
}: {
  legend: string;
  hint?: string;
  name: string;
  spells: readonly SpellContent[];
  selected: readonly string[];
  max: number;
  onToggle: (spellId: string) => void;
  disabled?: boolean;
}) {
  const full = selected.length >= max;
  const levels = [...new Set(spells.map((s) => s.data.level))];
  return (
    <Fieldset
      legend={legend}
      hint={`${hint ? `${hint} ` : ""}${selected.length} de ${max} elegidos.`}
    >
      {levels.map((level) => (
        <div key={level} className="grid gap-2">
          {levels.length > 1 && (
            <p className="text-sm font-medium text-muted-foreground">
              {spellLevelText(level)}
            </p>
          )}
          {spells
            .filter((s) => s.data.level === level)
            .map((spell) => {
              const checked = selected.includes(spell.id);
              return (
                <SpellOption
                  key={spell.id}
                  name={name}
                  spell={spell}
                  checked={checked}
                  disabled={disabled || (!checked && full)}
                  onChange={() => onToggle(spell.id)}
                />
              );
            })}
        </div>
      ))}
    </Fieldset>
  );
}

// Como `Option`, pero con el texto del conjuro para leer antes de elegir.
function SpellOption({
  name,
  spell,
  checked,
  disabled,
  onChange,
}: {
  name: string;
  spell: SpellContent;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card has-checked:border-primary has-checked:bg-accent">
      <label className="flex cursor-pointer items-start gap-3 p-3 has-disabled:cursor-not-allowed has-disabled:opacity-50">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={onChange}
          className="mt-1 accent-primary"
        />
        <span className="grid gap-0.5">
          <span className="font-medium">{spell.name}</span>
          <span className="text-sm text-muted-foreground">
            {spellSummary(spell)}
          </span>
        </span>
      </label>
      <details className="px-3 pb-3">
        <summary className="cursor-pointer text-sm text-muted-foreground">
          Ver el conjuro
        </summary>
        <div className="mt-2">
          <SpellBody spell={spell} />
        </div>
      </details>
    </div>
  );
}
