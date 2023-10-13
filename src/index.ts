if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY env var not found");
  process.exit(1);
}

const chatSecret = process.env.REQ_SECRET;

if (!chatSecret) {
  console.warn(
    "REQ_SECRET env var not found, clients will not be authenticated"
  );
}

import _basePrompt from "./prompt.json" assert { type: "json" };
import { getServerAddress } from "./utils/addr";
import mysql from "mysql2/promise";

import dbConfig from "./db-config";

// Connect to the database
const db = await mysql.createConnection(dbConfig);

import OpenAI from "openai";
type ChatCompletionMessage = Parameters<
  typeof OpenAI.Chat.Completions.prototype.create
>[0]["messages"][number];

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

  /**
   * The messages that have been sent
   * between the client and the server
   */
  messages: ChatCompletionMessage[];
};

const server = Bun.serve<WebSocketData>({
  development: isDevelopment,
  port: process.env.PORT || "3001",
  async fetch(req, server) {
    const url = new URL(req.url);

    switch (url.pathname) {
      case "/chat": {
        // upgrade the request to a WebSocket
        if (
          server.upgrade(req, {
            data: {
              authed: false,
              messages: basePrompt.messages,
            },
          })
        ) {
          return;
        } else {
          return new Response("Upgrade failed :(", { status: 500 });
        }
      }

      case "/send": {
        if (req.method == "POST") {
          const body = await req.json();

          await db.execute(
            "INSERT INTO users (NAME, USERNAME, PASSWORD, DOB, WEIGHT, HEIGHT, GENDER) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              body.NAME,
              body.USERNAME,
              body.PASSWORD,
              body.DOB,
              body.WEIGHT,
              body.HEIGHT,
              body.GENDER,
            ]
          );
        }

        break;
      }

      case "/receive": {
        if (req.method == "GET") {
          const [rows] = await db.execute("SELECT * FROM users");
          return new Response(JSON.stringify(rows));
        }

        break;
      }

      case "/search": {
        if (req.method == "POST") {
          const body = await req.json();
          const [rows] = await db.execute(
            "SELECT * FROM users WHERE USERNAME = ?",
            [body.USERNAME]
          );
          return new Response(JSON.stringify(rows));
        }

        break;
      }

      case "/login": {
        if (req.method == "POST") {
          const body = await req.json();
          const [rows] = await db.execute(
            "SELECT * FROM users WHERE USERNAME = ? AND PASSWORD = ?",
            [body.username, body.password]
          );

          if (!("length" in rows)) {
            return new Response("Oops [1]", {
              status: 500,
            });
          }

          if (rows.length == 0) {
            return new Response("Invalid username or password", {
              status: 401,
            });
          }

          const user = rows[0];

          if (!("ID" in user) || typeof user.ID != "number") {
            return new Response("Oops [2]", {
              status: 500,
            });
          }

          return new Response(user.ID.toString());
        }

        break;
      }

      case "/edit": {
        if (req.method == "POST") {
          const body = await req.json();
          await db.execute(
            "UPDATE users SET NAME = ?, DOB = ?, GENDER = ?, WEIGHT = ?, HEIGHT = ? WHERE USERNAME = ?",
            [
              body.NAME,
              body.DOB,
              body.GENDER,
              body.WEIGHT,
              body.HEIGHT,
              body.USERNAME,
            ]
          );
        }

        break;
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
        const rand = Math.random();
        if (rand > 0.666) {
          ws.send("Hello, demo response message!");
          ws.send(streamEndToken);
        } else if (rand > 0.333) {
          let intv: number | Timer = 0;
          intv = setInterval(() => {
            ws.send(Math.random().toString(36).substring(2, 5));
          }, 50);
          setTimeout(() => {
            clearInterval(intv);
            ws.send(streamEndToken);
          }, 5000);
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
