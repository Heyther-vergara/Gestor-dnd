import type { SheetFeature } from "@/rules-engine/engine";

// Rasgos de clase y subclase ya ganados (ADR 0016). El texto viene del SRD en
// inglés, como el resto del contenido importado; se abre al tocarlo para que
// la hoja no sea larguísima en el celular.
export function FeatureList({ features }: { features: SheetFeature[] }) {
  return (
    <ul className="grid gap-2">
      {features.map((feature) => (
        <li key={`${feature.sourceId}-${feature.name}`}>
          <details className="rounded-lg border border-border bg-card p-3">
            <summary className="cursor-pointer">
              <span className="font-medium">{feature.name}</span>{" "}
              <span className="text-sm text-muted-foreground">
                · nivel {feature.level}
              </span>
            </summary>
            <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
              {feature.description}
            </p>
          </details>
        </li>
      ))}
    </ul>
  );
}
