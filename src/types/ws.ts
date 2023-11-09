import type { User } from "@supabase/supabase-js";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";

export type WebSocketData = {
  /**
   * Wether the client has sent the correct
   * `chatSecret` to authenticate
   */
  authed: boolean;

  user: User | null;

  /**
   * The messages that have been sent
   * between the client and the server
   */
  messages: ChatCompletionMessageParam[];

  dev: boolean;
};
