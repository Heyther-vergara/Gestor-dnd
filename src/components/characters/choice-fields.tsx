import type { ReactNode } from "react";

// Piezas de formulario compartidas por el creador (ADR 0015) y la pantalla de
// subir de nivel (ADR 0016).

// Grupo de opciones con título. `fieldset` + `legend` hace que el lector de
// pantalla lea el título al entrar a cualquiera de las opciones.
export function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 font-heading text-lg font-bold text-primary">
        {legend}
      </legend>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      {children}
    </fieldset>
  );
}

// Una opción grande, fácil de tocar en el celular.
export function Option({
  type,
  name,
  checked,
  disabled,
  onChange,
  title,
  detail,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
  detail?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 has-checked:border-primary has-checked:bg-accent has-disabled:cursor-not-allowed has-disabled:opacity-50">
      <input
        type={type}
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="mt-1 accent-primary"
      />
      <span className="grid gap-0.5">
        <span className="font-medium">{title}</span>
        {detail && (
          <span className="text-sm text-muted-foreground">{detail}</span>
        )}
      </span>
    </label>
  );
}
