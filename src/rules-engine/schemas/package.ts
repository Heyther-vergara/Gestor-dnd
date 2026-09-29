import { z } from "zod";

import { editionSchema, slugSchema } from "./common";

// Un paquete agrupa contenido: el SRD oficial o un homebrew de un usuario.
export const packageSchema = z.strictObject({
  id: slugSchema,
  name: z.string().min(1),
  edition: editionSchema,
  author: z.string().min(1),
  version: z.string().min(1),
  visibility: z.enum(["private", "public"]),
  source: z.enum(["srd", "homebrew"]),
});

export type Package = z.infer<typeof packageSchema>;
