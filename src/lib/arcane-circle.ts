// Geometría del "círculo de invocación" decorativo de los márgenes (ADR 0031).
// Son solo figuras: anillos, una estrella de 7 puntas, marcas como de reloj y
// sigilos inventados (segmentos entre vértices de un hexágono; no son de
// ningún alfabeto real). Es TypeScript puro y determinista: con la misma
// semilla da siempre el mismo dibujo, así el HTML del servidor y del
// navegador coinciden y se puede testear.

export const CIRCLE_SIZE = 340;
const C = CIRCLE_SIZE / 2;
const OUTER = 150;
const INNER = 138;
const CORE = 96;
const SIGIL_RING = 117;

const fmt = (n: number) => n.toFixed(1);
const point = (radius: number, angle: number) =>
  `${fmt(C + radius * Math.cos(angle))} ${fmt(C + radius * Math.sin(angle))}`;

// Generador pseudoaleatorio simple (Park-Miller): no necesita ser seguro,
// solo repetible.
export function seededRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

export type ArcaneCircle = {
  rings: number[];
  star: string;
  ticks: string;
  sigils: string[];
};

export function arcaneCircle(seed: number): ArcaneCircle {
  const random = seededRandom(seed);

  // Estrella {7/2}: se une cada vértice con el que está dos más adelante.
  const star =
    Array.from(
      { length: 7 },
      (_, i) =>
        `${i === 0 ? "M" : "L"}${point(INNER, (i * 4 * Math.PI) / 7 - Math.PI / 2)}`,
    ).join("") + "Z";

  // 48 marcas en el borde; una de cada cuatro, más larga.
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const angle = (i * Math.PI) / 24;
    const length = i % 4 === 0 ? 14 : 6;
    return `M${point(OUTER, angle)}L${point(OUTER + length, angle)}`;
  }).join("");

  // 12 sigilos repartidos en un anillo, cada uno de 3 trazos.
  const sigils = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * Math.PI) / 6;
    const cx = C + SIGIL_RING * Math.cos(angle);
    const cy = C + SIGIL_RING * Math.sin(angle);
    const vertex = (k: number) =>
      `${fmt(cx + 7 * Math.cos((k * Math.PI) / 3))} ${fmt(cy + 7 * Math.sin((k * Math.PI) / 3))}`;
    return Array.from({ length: 3 }, () => {
      const from = Math.floor(random() * 6);
      const to = (from + 1 + Math.floor(random() * 5)) % 6;
      return `M${vertex(from)}L${vertex(to)}`;
    }).join("");
  });

  return { rings: [OUTER, INNER, CORE], star, ticks, sigils };
}
