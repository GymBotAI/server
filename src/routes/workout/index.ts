import { makeOpenAi, openaiChatModel } from "../../openai";
import workoutSchema from "./schema";

export default async function handler(req: Request, env: Env) {
  const data = workoutSchema.safeParse(await req.json().catch(() => null));

  if (!data.success) {
    return new Response("Invalid body", { status: 400 });
  }

  let prompt = `Generate a workout for the user that lasts ${
    data.data.duration
  } minutes. Their goal is to ${JSON.stringify(
    data.data.goal
  )}, and their subgoal is to ${JSON.stringify(
    data.data.subgoal
  )}. They have access to the following equipment: ${data.data.equipment
    .map((s) => JSON.stringify(s))
    .join(", ")}`;
  if (data.data.notes) {
    prompt += `. Other notes from the user: ${JSON.stringify(data.data.notes)}`;
  }
  prompt +=
    "\nReturn the workout as a JSON object in the following format:\n```ts";
  prompt += /*javascript*/ `
    interface Workout {
      title: string;
      description: string;
      equipment: string[];
      exercises: Exercise[];
    };

    interface Exercise {
      name: string;
      description: string;
      sets: number;
      reps: number;
      rest: number;
    };
  `;
  prompt += "```";

  const openai = makeOpenAi(env);

  const completion = await openai.chat.completions.create({
    model: openaiChatModel,
    response_format: {
      type: "json_object",
    },
    messages: [{ role: "system", content: prompt }],
  });

  return new Response(completion.choices[0].message.content, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
