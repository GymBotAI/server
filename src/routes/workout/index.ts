import workoutSchema from "../../schemas/workout";

import { openai, openaiChatModel } from "../../openai";

export default async function handler(req: Request) {
  if (req.method != "POST") {
    return new Response("Invalid method", { status: 405 });
  }

  const data = workoutSchema.safeParse(await req.json().catch(() => null));

  if (!data.success) {
    return new Response("Invalid body", { status: 400 });
  }

  let prompt = `Generate a workout for bodypart ${JSON.stringify(
    data.data.bodypart
  )} that lasts ${data.data.duration} minutes.`;
  if (data.data.notes) {
    prompt += ` Other notes from the user: ${JSON.stringify(data.data.notes)}`;
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
