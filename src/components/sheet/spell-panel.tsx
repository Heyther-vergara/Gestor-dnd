import { SpellChoiceList } from "@/components/spells/spell-choice-list";
import { contentNameById } from "@/lib/format";
import {
  type ClassSpellOptions,
  classSpellOptions,
  type SpellListKind,
} from "@/lib/spells";
import type { ContentIndex } from "@/rules-engine/engine";
import type { Character } from "@/rules-engine/schemas";

// Cambiar los conjuros desde la hoja (ADR 0021). Las reglas (cuántos, de qué
// nivel, del libro) están en `lib/spells`: aquí solo se muestran las listas
// y cada marca se manda como acción. No se controla que sea después de un
// descanso largo: como el resto de la hoja, confía en el jugador.
export function SpellPanel({
  character,
  index,
  disabled,
  onToggle,
}: {
  character: Character;
  index: ContentIndex;
  disabled: boolean;
  onToggle: (classId: string, kind: SpellListKind, spellId: string) => void;
}) {
  const classes = character.classes.flatMap((entry) => {
    const options = classSpellOptions(character, entry.classId, index);
    return options ? [{ entry, options }] : [];
  });
  return (
    <div className="grid gap-3">
      {classes.map(({ entry, options }) => (
        <ClassSpellPanel
          key={entry.classId}
          title={
            classes.length > 1 ? contentNameById(entry.classId, index) : null
          }
          entry={entry}
          options={options}
          disabled={disabled}
          onToggle={(kind, spellId) => onToggle(entry.classId, kind, spellId)}
        />
      ))}
    </div>
  );
}

function ClassSpellPanel({
  title,
  entry,
  options,
  disabled,
  onToggle,
}: {
  title: string | null;
  entry: Character["classes"][number];
  options: ClassSpellOptions;
  disabled: boolean;
  onToggle: (kind: SpellListKind, spellId: string) => void;
}) {
  const { limits } = options;
  const cantripIds = entry.cantripIds ?? [];
  const spellbookIds = entry.spellbookIds ?? [];
  const preparedIds = entry.preparedSpellIds ?? [];
  const toPrepare = limits.prepared - preparedIds.length;
  const sectionClass = "rounded-lg border border-border bg-card p-3";
  const summaryClass = "cursor-pointer font-medium";

  return (
    <div className="grid gap-2">
      {title && <h3 className="font-medium">{title}</h3>}
      {toPrepare > 0 && options.prepared.length > 0 && (
        <p className="rounded-sm border border-gold/40 bg-gold/10 p-3 text-sm">
          Puedes preparar {toPrepare}{" "}
          {toPrepare === 1 ? "conjuro más" : "conjuros más"}: elígelos en
          &quot;Preparar conjuros&quot;.
        </p>
      )}

      {limits.prepared > 0 && (
        <details className={sectionClass}>
          <summary className={summaryClass}>Preparar conjuros</summary>
          <div className="mt-3">
            {/* SRD 5.2.1, mago, "Cambiar tus conjuros preparados": al terminar
                un descanso largo. */}
            <SpellChoiceList
              legend="Conjuros preparados"
              hint={
                options.spellbook
                  ? "Se preparan del libro y se cambian al terminar un descanso largo."
                  : "Se cambian al terminar un descanso largo."
              }
              name={`prepared-${entry.classId}`}
              spells={options.prepared}
              selected={preparedIds}
              max={limits.prepared}
              disabled={disabled}
              onToggle={(id) => onToggle("preparedSpellIds", id)}
            />
          </div>
        </details>
      )}

      {limits.cantrips > 0 && (
        <details className={sectionClass}>
          <summary className={summaryClass}>Cambiar trucos</summary>
          <div className="mt-3">
            {/* SRD 5.2.1, mago, "Trucos": al terminar un descanso largo puedes
                cambiar uno por otro. */}
            <SpellChoiceList
              legend="Trucos"
              hint="Al terminar un descanso largo puedes cambiar uno: desmarca uno y marca otro."
              name={`cantrips-${entry.classId}`}
              spells={options.cantrips}
              selected={cantripIds}
              max={limits.cantrips}
              disabled={disabled}
              onToggle={(id) => onToggle("cantripIds", id)}
            />
          </div>
        </details>
      )}

      {options.spellbook && limits.spellbook !== null && (
        <details className={sectionClass}>
          <summary className={summaryClass}>Anotar en el libro</summary>
          <div className="mt-3">
            <SpellChoiceList
              legend="Libro de conjuros"
              hint="Los conjuros nuevos se eligen al subir de nivel. Usa esto para completar o corregir el libro."
              name={`spellbook-${entry.classId}`}
              spells={options.spellbook}
              selected={spellbookIds}
              max={limits.spellbook}
              disabled={disabled}
              onToggle={(id) => onToggle("spellbookIds", id)}
            />
          </div>
        </details>
      )}
    </div>
  );
}
