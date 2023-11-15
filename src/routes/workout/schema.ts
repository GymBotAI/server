import { z } from "zod";

export default z.object({
  equipment: z.array(z.string()).min(1),
  goal: z.string().min(2),
  subgoal: z.string().min(2),
  duration: z.number().min(5),
  notes: z.union([z.null(), z.string()]),
});
