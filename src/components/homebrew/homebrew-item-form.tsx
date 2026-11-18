"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { damageTypeNames } from "@/lib/format";
import {
  type BonusTarget,
  bonusTargetGroups,
  buildHomebrewItem,
  draftFromHomebrewItem,
  emptyHomebrewItemDraft,
  type HomebrewItem,
  type HomebrewItemDraft,
  homebrewItemId,
  isBonusTarget,
  MAX_BONUS,
  MAX_ITEM_DESCRIPTION_LENGTH,
  MAX_ITEM_NAME_LENGTH,
  randomSuffix,
} from "@/lib/homebrew";
import { damageTypeSchema } from "@/rules-engine/schemas";

// Mismo estilo que los inputs de shadcn (y que el creador de personajes).
const inputClass =
  "h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

// En pantalla el bonificador es texto: así se puede escribir "-" o borrar el
// campo sin que salte a 0. Se convierte a número al guardar.
type BonusRow = { key: number; target: BonusTarget; value: string };

// Formulario para crear o editar un objeto homebrew (ADR 0019). Sin
// librerías de formularios: es un estado de React, como el creador de
// personajes. La validación es la de `lib/homebrew`, la misma que tiene test.
export function HomebrewItemForm({
  packageId,
  editing,
  onSave,
  onCancel,
}: {
  packageId: string;
  editing: HomebrewItem | null;
  // Devuelve false si no se pudo guardar.
  onSave: (item: HomebrewItem) => boolean;
  onCancel?: () => void;
}) {
  const ids = useId();
  const start = editing
    ? draftFromHomebrewItem(editing)
    : emptyHomebrewItemDraft;
  const [name, setName] = useState(start.name);
  const [description, setDescription] = useState(start.description);
  const [requiresAttunement, setRequiresAttunement] = useState(
    start.requiresAttunement,
  );
  const [bonuses, setBonuses] = useState<BonusRow[]>(
    // El objeto de ejemplo del MVP (+1 a la CA) como punto de partida.
    editing
      ? start.bonuses.map((b, key) => ({ ...b, value: String(b.value), key }))
      : [{ key: 0, target: "ac", value: "1" }],
  );
  const [resistances, setResistances] = useState(start.resistances);
  // Los errores se muestran recién después del primer intento de guardar,
  // para no retar a nadie antes de que escriba.
  const [tried, setTried] = useState(false);
  const [storeFailed, setStoreFailed] = useState(false);

  const draft: HomebrewItemDraft = {
    name,
    description,
    requiresAttunement,
    bonuses: bonuses.map((b) => ({
      target: b.target,
      value: b.value.trim() === "" ? Number.NaN : Number(b.value),
    })),
    resistances,
  };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTried(true);
    const id = editing?.id ?? homebrewItemId(name, randomSuffix());
    const result = buildHomebrewItem(draft, packageId, id);
    if (!result.ok) return;
    setStoreFailed(!onSave(result.item));
  }

  const result = buildHomebrewItem(draft, packageId, "preview");
  const errors = tried && !result.ok ? result.errors : [];
  const nextKey = Math.max(-1, ...bonuses.map((b) => b.key)) + 1;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-name`} className="font-medium">
          Nombre
        </label>
        <input
          id={`${ids}-name`}
          className={inputClass}
          value={name}
          maxLength={MAX_ITEM_NAME_LENGTH}
          autoComplete="off"
          placeholder="Anillo de protección"
          aria-invalid={tried && name.trim() === ""}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="grid gap-1">
        <label htmlFor={`${ids}-description`} className="font-medium">
          Descripción <span className="text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id={`${ids}-description`}
          className={`${inputClass} h-auto min-h-20 py-2`}
          value={description}
          maxLength={MAX_ITEM_DESCRIPTION_LENGTH}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={requiresAttunement}
          onChange={(e) => setRequiresAttunement(e.target.checked)}
          className="mt-1 accent-primary"
        />
        <span className="grid gap-0.5">
          <span className="font-medium">Requiere sintonización</span>
          <span className="text-sm text-muted-foreground">
            Sus efectos solo cuentan si el personaje está sintonizado. Al darle
            el objeto queda sintonizado.
          </span>
        </span>
      </label>

      <fieldset className="grid gap-2">
        <legend className="mb-1 font-medium">Bonificadores</legend>
        <p className="text-sm text-muted-foreground">
          Se suman a la hoja mientras el personaje lo tenga. Un número negativo
          es una penalización (entre −{MAX_BONUS} y +{MAX_BONUS}).
        </p>
        {bonuses.map((row, i) => (
          <div key={row.key} className="flex items-end gap-2">
            <div className="grid min-w-0 flex-1 gap-1">
              <label
                htmlFor={`${ids}-target-${row.key}`}
                className="text-sm text-muted-foreground"
              >
                Bonificador {i + 1}: a qué
              </label>
              <select
                id={`${ids}-target-${row.key}`}
                className={inputClass}
                value={row.target}
                onChange={(e) => {
                  const target = e.target.value;
                  if (!isBonusTarget(target)) return;
                  setBonuses((list) =>
                    list.map((b) => (b.key === row.key ? { ...b, target } : b)),
                  );
                }}
              >
                {bonusTargetGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option key={option.target} value={option.target}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="grid w-20 gap-1">
              <label
                htmlFor={`${ids}-value-${row.key}`}
                className="text-sm text-muted-foreground"
              >
                Cuánto
              </label>
              <input
                id={`${ids}-value-${row.key}`}
                className={`${inputClass} tabular-nums`}
                type="number"
                inputMode="numeric"
                step={1}
                min={-MAX_BONUS}
                max={MAX_BONUS}
                value={row.value}
                onChange={(e) => {
                  const value = e.target.value;
                  setBonuses((list) =>
                    list.map((b) => (b.key === row.key ? { ...b, value } : b)),
                  );
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Quitar bonificador ${i + 1}`}
              onClick={() =>
                setBonuses((list) => list.filter((b) => b.key !== row.key))
              }
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            setBonuses((list) => [
              ...list,
              { key: nextKey, target: "ac", value: "1" },
            ])
          }
        >
          Agregar bonificador
        </Button>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-1 font-medium">Resistencias</legend>
        <p className="text-sm text-muted-foreground">
          El personaje recibe la mitad del daño de estos tipos.
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {damageTypeSchema.options.map((type) => (
            <label key={type} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-primary"
                checked={resistances.includes(type)}
                onChange={(e) =>
                  setResistances((list) =>
                    e.target.checked
                      ? [...list, type]
                      : list.filter((t) => t !== type),
                  )
                }
              />
              <span className="first-letter:uppercase">
                {damageTypeNames[type]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {errors.length > 0 && (
        <ul
          className="grid gap-1 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {storeFailed && (
        <p className="text-sm text-destructive" role="alert">
          No se pudo guardar en este navegador.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit">
          {editing ? "Guardar cambios" : "Crear objeto"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
