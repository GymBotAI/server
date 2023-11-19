import OpenAI from "openai";

export function makeOpenAi(env: Env) {
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });
}

export const openaiChatModel = "gpt-3.5-turbo-1106";
