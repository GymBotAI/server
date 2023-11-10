import type { Server } from "bun";
import type { ChatCompletionMessageParam } from "openai/resources/index.js";

import { isDevelopment } from "../../consts";

import _basePrompt from "../../prompt.json";

const basePrompt = _basePrompt as {
  messages: ChatCompletionMessageParam[];
};

export default async function handler(req: Request, server: Server) {
  // upgrade the request to a WebSocket
  if (
    server.upgrade(req, {
      data: {
        authed: false,
        messages: basePrompt.messages,
        dev: isDevelopment,
      },
    })
  ) {
    return;
  } else {
    return new Response("Upgrade failed :(", { status: 500 });
  }
}
