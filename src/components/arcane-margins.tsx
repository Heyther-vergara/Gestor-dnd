import { arcaneCircle, CIRCLE_SIZE } from "@/lib/arcane-circle";

// Decoración de los márgenes en pantallas anchas (ADR 0031): un círculo de
// invocación a cada lado, cortado por el borde, que gira muy despacio.
// - Solo desde 1440 px: en pantallas más chicas no hay margen libre.
// - Cada lado se recorta al ancho del margen (la hoja mide 72rem), así nunca
//   pasa por debajo del contenido.
// - Es decoración: aria-hidden, no se puede tocar ni seleccionar, y con
//   "reducir movimiento" se queda quieto (motion-safe).
// - Server Component sin JavaScript: el dibujo se calcula al renderizar.
export function ArcaneMargins() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 hidden text-gold opacity-25 select-none min-[1440px]:block dark:opacity-20"
    >
      <Side side="left" seed={3} top="32%" />
      <Side side="right" seed={7} top="68%" />
    </div>
  );
}

function Side({
  side,
  seed,
  top,
}: {
  side: "left" | "right";
  seed: number;
  top: string;
}) {
  const circle = arcaneCircle(seed);
  const c = CIRCLE_SIZE / 2;
  return (
    <div
      className={`absolute inset-y-0 w-[calc((100vw-72rem)/2)] overflow-hidden ${side === "left" ? "left-0" : "right-0"}`}
    >
      <svg
        viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
        width={CIRCLE_SIZE}
        height={CIRCLE_SIZE}
        // El centro queda 30 px afuera de la pantalla: se ve un arco grande.
        style={{
          top,
          [side]: -c - 30,
          marginTop: -c,
        }}
        className={`absolute will-change-transform motion-safe:animate-[arcane-spin_240s_linear_infinite] ${side === "right" ? "motion-safe:[animation-direction:reverse]" : ""}`}
        fill="none"
        stroke="currentColor"
      >
        {circle.rings.map((r, i) => (
          <circle
            key={r}
            cx={c}
            cy={c}
            r={r}
            strokeWidth={i === 0 ? 1.5 : 0.8}
          />
        ))}
        <path d={circle.star} strokeWidth={0.8} />
        <path d={circle.ticks} strokeWidth={0.8} />
        {circle.sigils.map((d, i) => (
          <path key={i} d={d} strokeWidth={1.1} strokeLinecap="round" />
        ))}
      </svg>
    </div>
  );
}
