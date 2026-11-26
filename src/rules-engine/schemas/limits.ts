import { z } from "zod";

// Topes de tamaño para los datos que entran de afuera: archivos homebrew,
// localStorage y Supabase (ADR 0023 · SOC 2 CC6.6 · ISO 27001 A.8.26).
//
// Son muy holgados: el texto más largo del SRD 5.2.1 tiene unos 3.000
// caracteres, el nombre más largo unos 30 y el efecto más grande vale 120
// (visión en la oscuridad). No limitan el contenido real; solo frenan datos
// absurdos, como un JSON de 200 MB que congelaría la pestaña o una fila
// gigante en la base.
export const LIMITS = {
  /** Nombres: de contenido, rasgos, recursos, personajes. */
  name: 100,
  /** Descripciones y textos largos. */
  text: 20_000,
  /** Ids (slugs y el id del personaje). Igual que el `check` de la tabla. */
  id: 64,
  /** Listas: rasgos de una clase, inventario, elecciones… */
  list: 200,
  /** Efectos de un mismo contenido o rasgo. */
  effects: 50,
  /** Valor absoluto máximo de un efecto numérico. */
  effectValue: 1000,
} as const;

export const nameSchema = z.string().min(1).max(LIMITS.name);
export const longTextSchema = z.string().max(LIMITS.text);
