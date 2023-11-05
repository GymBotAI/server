if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY env var not found");
  process.exit(1);
}

import { supabase } from "./supabase";

import _basePrompt from "./prompt.json" assert { type: "json" };
import { getServerAddress } from "./utils/addr";

import OpenAI from "openai";
type ChatCompletionMessage = Parameters<
  typeof OpenAI.Chat.Completions.prototype.create
>[0]["messages"][number];

import { parse as parseCookie } from "cookie";

import type { User } from "@supabase/supabase-js";

const basePrompt = _basePrompt as {
  messages: ChatCompletionMessage[];
};

const isDevelopment =
  !process.argv.includes("--prod") && process.env.NODE_ENV != "production";

const openaiChatModel = "gpt-3.5-turbo";
const openai = new OpenAI();

const streamEndToken = "[DONE]";

type WebSocketData = {
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
  messages: ChatCompletionMessage[];

  dev: boolean;
};

const server = Bun.serve<WebSocketData>({
  development: isDevelopment,
  port: process.env.PORT || "3001",
  async fetch(req, server) {
    let url: URL;
    try {
      url = new URL(req.url);
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    const cookies = parseCookie(req.headers.get("cookie") || "");

    switch (url.pathname) {
      case "/chat": {
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
    }

    return new Response();
  },
  websocket: {
    open(ws) {
      console.debug(`[${ws.remoteAddress}]`, "WS client connected");
    },
    close(ws) {
      console.debug(`[${ws.remoteAddress}]`, "WS client disconnected");
    },
    async message(ws, message) {
      if (typeof message != "string") {
        return;
      }

      // WebSocket auth
      if (!ws.data.authed) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(message);
        ws.data.authed = !!user && !userError;

        if (userError) {
          console.error(
            `[${ws.remoteAddress}]`,
            "WS auth error:",
            userError.message
          );
          console.debug(`[${ws.remoteAddress}]`, "WS client closed by server");
          ws.close();
        }

        if (ws.data.authed) {
          ws.data.user = user;
          console.debug(`[${ws.remoteAddress}]`, "WS client authenticated");

          // Load user info
          const { data: userData, error: userDataError } = await supabase
            .from("users")
            .select("*")
            .eq("id", user!.id)
            .single();

          if (userDataError || !userData) {
            console.error(
              `[${ws.remoteAddress}]`,
              "WS user data error:",
              userDataError
            );
            console.debug(
              `[${ws.remoteAddress}]`,
              "WS client closed by server"
            );
            ws.close();
          }

          let userDataMessage = `The current date and time is ${new Date()}.\n`;

          for (const key of [
            "name",
            "birthday",
            "gender",
            "weight",
            "height",
          ] as const) {
            const value = userData![key];

            if (value != null) {
              userDataMessage += `The user's ${key} is ${value}.\n`;
            }
          }

          if (userDataMessage) {
            // Add user info to messages
            ws.data.messages.push({
              role: "system",
              content: userDataMessage,
            });
          }
        }

        return;
      }

      console.debug(`[${ws.remoteAddress}]`, "WS message:", message);

      if (message == "!dev" && isDevelopment) {
        ws.data.dev = true;
        ws.send("Switched to development mode!");
        ws.send(streamEndToken);
        return;
      }

      // Demo messages in development
      if (ws.data.dev) {
        if (message == "!prod") {
          ws.data.dev = false;
          ws.send("Switched to production mode!");
          ws.send(streamEndToken);
          return;
        }

        const rand = Math.random();
        if (rand > 0.9) {
          ws.send("Hello, demo response message!");
          ws.send(streamEndToken);
        } else if (rand > 0.6) {
          let intv: number | Timer = 0;
          intv = setInterval(() => {
            ws.send(Math.random().toString(36).substring(2, 5));
          }, 50);
          setTimeout(() => {
            clearInterval(intv);
            ws.send(streamEndToken);
          }, 5000);
        } else if (rand > 0.3) {
          ws.send("\u0007");
          ws.send(streamEndToken);
        } else {
          ws.send("This is a paragraph");
          ws.send(streamEndToken);
          ws.send("This is another");
          ws.send(streamEndToken);
        }
        return;
      }

      ws.data.messages.push({
        role: "user",
        content: message,
      });

      try {
        const chatCompletion = await openai.chat.completions.create({
          model: openaiChatModel,
          messages: ws.data.messages,
          stream: true,
        });

        ws.data.messages.push({
          role: "assistant",
          content: "",
        });

        for await (const chunk of chatCompletion) {
          const chunkContent = chunk.choices[0].delta.content;

          if (typeof chunkContent != "string") {
            continue;
          }

          ws.data.messages[ws.data.messages.length - 1].content += chunkContent;

          // Split message newlines into different messages
          // A.K.A. chunking
          const lines = chunkContent.split(/(?:\r?\n){1,2}/);
          for (let _i in lines) {
            const i = parseInt(_i);

            ws.send(lines[i]);
            if (i < lines.length - 1) {
              ws.send(streamEndToken);
            }
          }
        }

        ws.send(streamEndToken);
      } catch (err) {
        console.error("Error in chatCompletion:", err);
      }
    },
  },
});

if (isDevelopment) {
  console.warn("In development mode!");
} else {
  console.log("In production mode!");
}

console.log("Local server address:", getServerAddress(server));
