import { z } from "zod";

// Identificador en kebab-case: "fighter", "magic-missile", "srd-2024".
export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Debe estar en kebab-case");

export const editionSchema = z.enum(["2014", "2024"]);

// Los seis atributos, con abreviaturas en inglés como en el SRD.
export const abilitySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

// Las 18 habilidades del SRD.
export const skillSchema = z.enum([
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
]);

export type Slug = z.infer<typeof slugSchema>;
export type Edition = z.infer<typeof editionSchema>;
export type Ability = z.infer<typeof abilitySchema>;
export type Skill = z.infer<typeof skillSchema>;
