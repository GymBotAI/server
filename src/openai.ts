import OpenAI from "openai";
type ChatCompletionMessage = Parameters<
  typeof OpenAI.Chat.Completions.prototype.create
>[0]["messages"][number];

export const openai = new OpenAI();
export const openaiChatModel = "gpt-3.5-turbo-1106";
