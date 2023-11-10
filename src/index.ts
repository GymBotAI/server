import type { WebSocketData } from "./types/ws";

import { parse as parseCookie } from "cookie";

import { isDevelopment, streamEndToken } from "./consts";
import { openai, openaiChatModel } from "./openai";
import chat from "./routes/chat";
import workout from "./routes/workout";
import { supabase } from "./supabase";
import { getServerAddress } from "./utils/addr";

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

    switch (url.pathname) {
      case "/chat": {
        return await chat(req, server);
      }

      case "/workout": {
        return await workout(req);
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
