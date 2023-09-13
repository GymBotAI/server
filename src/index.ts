import { dirname } from "path";
import { fileURLToPath } from "url";
import _basePrompt from "./prompt.json" assert { type: "json" };

import { Configuration as OpenAIConfig, OpenAIApi } from "openai";
import type { ChatCompletionRequestMessage } from "openai";

const basePrompt = _basePrompt as {
  messages: ChatCompletionRequestMessage[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));

const isDevelopment = process.env.NODE_ENV != "production";

const openaiChatModel = "gpt-3.5-turbo";
const openai = new OpenAIApi(
  new OpenAIConfig({
    apiKey: process.env.OPENAI_KEY,
  })
);

const streamEndToken = "[DONE]";

const chatSecret = process.env.REQ_SECRET;

type WebSocketData = {
  /**
   * Wether the client has sent the correct
   * `chatSecret` to authenticate
   */
  authed: boolean;

  /**
   * The messages that have been sent
   * between the client and the server
   */
  messages: ChatCompletionRequestMessage[];
};

Bun.serve<WebSocketData>(
  {
    development: isDevelopment,
    port: process.env.PORT || "3001",
    fetch(req, server) {
      // upgrade the request to a WebSocket
      if (
        server.upgrade(req, {
          data: {
            authed: false,
            messages: [],
          },
        })
      ) {
        return;
      }

      return new Response("Upgrade failed :(", { status: 500 });
    },
    websocket: {
      open(ws) {
        console.debug(`[${ws.remoteAddress}]`, "WS client connected");
      },
      message(ws, message) {
        if (typeof message != "string") {
          return;
        }

        // WebSocket auth
        if (!ws.data.authed) {
          if (chatSecret) {
            ws.data.authed = message == chatSecret;
          } else {
            console.warn("REQ_SECRET env var not found, skipping auth");
            ws.data.authed = true;
          }

          if (ws.data.authed) {
            console.debug(`[${ws.remoteAddress}]`, "WS client authenticated");
          }

          return;
        }

        console.debug(`[${ws.remoteAddress}]`, "WS message:", message);

        // Demo messages in development
        if (isDevelopment) {
          // ws.send("Hello, demo response message!");
          // ws.send(streamEndToken);
          //
          // let intv = 0;
          // intv = setInterval(() => {
          //   ws.send('aa\n');
          // }, 50);
          // setTimeout(() => {
          //   clearInterval(intv);
          //   ws.send(streamEndToken);
          // }, 5000);

          ws.send("This is a paragraph");
          ws.send(streamEndToken);
          ws.send("This is another");
          ws.send(streamEndToken);
          return;
        }
      },
    },
  }
  /*{
    idle_timeout: 60,
    max_payload_length: 32 * 1024,
  },
  async (ws) => {
    ws.on("message", async (data) => {
      messages.push({
        role: "user",
        content: data,
      });

      try {
        const chatCompletion = await openai.createChatCompletion(
          {
            model: openaiChatModel,
            messages,
            stream: true,
          },
          {
            responseType: "stream",
          }
        );

        messages.push({
          role: "assistant",
          content: "",
        });

        chatCompletion.data.on("data", (raw) => {
          const chunks = raw
            .toString()
            .split("\n\n")
            .map((s) => s.replace(/^data: /, ""));

          let finalChunk = "";
          let didEnd = false;

          for (const chunk of chunks) {
            if (!chunk) {
              continue;
            }

            if (chunk == streamEndToken) {
              didEnd = true;
              break;
            }

            let data = null;
            try {
              data = JSON.parse(chunk);
            } catch (err) {
              console.error(
                "Error parsing chunk:",
                err,
                "Chunk is",
                JSON.stringify(chunk)
              );
              return;
            }

            const chunkContent = data.choices[0]?.delta?.content;

            if (!chunkContent) {
              continue;
            }

            finalChunk += chunkContent;
          }

          messages[messages.length - 1].content += finalChunk;

          // Split message newlines into different messages
          // A.K.A. chunking
          const lines = finalChunk.split(/(?:\r?\n){1,2}/);
          for (let i in lines) {
            ws.send(lines[i]);
            if (i < lines.length - 1) {
              ws.send(streamEndToken);
            }
          }

          if (didEnd) {
            ws.send(streamEndToken);
          }
        });

        chatCompletion.data.on("end", () => {
          ws.send(streamEndToken);
        });
      } catch (err) {
        console.error("Error in chatCompletion:", err);
      }
    });

    ws.on("close", () => {
      console.debug(`[${ws.ip}]`, "WS client disconnected");
    });
  }*/
);

if (isDevelopment) {
  console.warn("In development mode!");
}
