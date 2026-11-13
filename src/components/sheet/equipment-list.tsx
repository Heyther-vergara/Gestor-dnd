import type { inventoryLines } from "@/lib/format";

// El inventario y las monedas, de solo lectura (ADR 0017). Recibe los textos
// ya armados: este componente no busca contenido.
export function EquipmentList({
  items,
  coins,
}: {
  items: ReturnType<typeof inventoryLines>;
  coins: string;
}) {
  if (items.length === 0 && coins === "") {
    return <p className="text-sm text-muted-foreground">Sin equipo.</p>;
  }
  return (
    <div className="grid gap-2">
      {items.length > 0 && (
        <ul className="grid gap-1 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.itemId}
              className="flex items-baseline justify-between gap-2 border-b border-border/60 py-1 text-sm"
            >
              <span>{item.label}</span>
              {item.equipped && (
                <span className="shrink-0 text-xs font-medium text-primary">
                  Equipado
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {coins !== "" && (
        <p className="text-sm tabular-nums">
          Monedas <b>{coins}</b>
        </p>
      )}
    </div>
  );
}
