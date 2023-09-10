import { dirname } from "path";
import { fileURLToPath } from "url";
import HyperExpress from "hyper-express";
import LiveDirectory from "live-directory";
import _basePrompt from "./prompt.json" assert { type: "json" };

import { Configuration as OpenAIConfig, OpenAIApi } from "openai";
import type { ChatCompletionRequestMessage } from "openai";

const basePrompt = _basePrompt as {
  messages: ChatCompletionRequestMessage[];
};

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = new HyperExpress.Server();

const isDevelopment = process.env.NODE_ENV != "production";

const openaiChatModel = "gpt-3.5-turbo";
const openai = new OpenAIApi(
  new OpenAIConfig({
    apiKey: process.env.OPENAI_KEY,
  })
);

const streamEndToken = "[DONE]";

// static files middleware
const staticFiles = new LiveDirectory(__dirname + "/../static", {
  static: !isDevelopment,
  filter: {
    ignore: {
      extensions: ["env"],
    },
  },
});

// serve static files
app.get("/*", (req, res) => {
  const path = req.path == "/" ? "/index.html" : req.path;
  const file = staticFiles.get(path);

  // return a 404 if no asset/file exists on the derived path
  if (!file) return res.status(404).send();

  if (file.cached) {
    res.send(file.content);
  } else {
    file.stream().pipe(res);
  }
});

// ChatGPT endpoint
app.ws(
  "/chat",
  {
    idle_timeout: 60,
    max_payload_length: 32 * 1024,
  },
  async (ws) => {
    console.debug(`[${ws.ip}]`, "WS client connected");

    let authed = false;
    let messages: ChatCompletionRequestMessage[] = basePrompt.messages;

    ws.on("message", async (data) => {
      if (!authed) {
        authed = data == process.env.REQ_SECRET;

        if (authed) {
          console.debug(`[${ws.ip}]`, "WS client authenticated");
        }

        return;
      }

      console.debug(`[${ws.ip}]`, "WS message:", data);

      if (isDevelopment) {
        // ws.atomic(() => {
        //   ws.send("Hello, demo response message!");
        //   ws.send(streamEndToken);
        // });
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
  }
);

app.listen(parseInt(process.env.PORT || "3001"));

if (isDevelopment) {
  console.warn("In development mode!");
}
