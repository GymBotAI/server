import { z } from "zod";

export default z.object({
  duration: z.number().positive(),
  bodypart: z.string().min(2),
  notes: z.union([z.null(), z.string()]),
});
