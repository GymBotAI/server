import type { ChatCompletionMessageParam } from "openai/resources/index.js";
import type { WebSocketData } from "../../types/ws";

import { streamEndToken } from "../../consts";
import { makeOpenAi, openaiChatModel } from "../../openai";
import { makeSupabase } from "../../supabase";

import _basePrompt from "../../prompt.json";

const basePrompt = _basePrompt as {
  messages: ChatCompletionMessageParam[];
};

export default class WsHandler {
  ws: WebSocket;
  data: WebSocketData;

  ip: string;

  env: Env;
  isDev: boolean;

  openai: ReturnType<typeof makeOpenAi>;
  supabase: ReturnType<typeof makeSupabase>;

  constructor(ws: WebSocket, ip: string, env: Env, isDev: boolean) {
    this.ws = ws;

    this.data = {
      authed: false,
      messages: basePrompt.messages,
      dev: isDev,
      user: null,
    };

    this.ip = ip;

    this.env = env;
    this.isDev = isDev;

    this.openai = makeOpenAi(env);
    this.supabase = makeSupabase(env);

    this.onOpen();
  }

  onOpen() {
    console.log(`[${this.ip}]`, "WS client connected");
  }

  onClose() {
    console.log(`[${this.ip}]`, "WS client disconnected");
  }

  async onMessage(e: MessageEvent) {
    if (typeof e.data != "string") {
      return;
    }

    // WebSocket auth
    if (!this.data.authed) {
      const {
        data: { user },
        error: userError,
      } = await this.supabase.auth.getUser(e.data);
      this.data.authed = !!user && !userError;

      if (userError) {
        console.error(`[${this.ip}]`, "WS auth error:", userError.message);
        console.log(`[${this.ip}]`, "WS client closed by server");
        this.ws.close();
      }

      if (this.data.authed) {
        this.data.user = user;
        console.log(`[${this.ip}]`, "WS client authenticated");

        // Load user info
        const { data: userData, error: userDataError } = await this.supabase
          .from("users")
          .select("*")
          .eq("id", user!.id)
          .single();

        if (userDataError || !userData) {
          console.error(`[${this.ip}]`, "WS user data error:", userDataError);
          console.log(`[${this.ip}]`, "WS client closed by server");
          this.ws.close();
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
          this.data.messages.push({
            role: "system",
            content: userDataMessage,
          });
        }
      }

      return;
    }

    console.log(`[${this.ip}]`, "WS message:", e.data);

    if (e.data == "!dev" && this.isDev) {
      this.data.dev = true;
      this.ws.send("Switched to development mode!");
      this.ws.send(streamEndToken);
      return;
    }

    // Demo messages in development
    if (this.data.dev) {
      if (e.data == "!prod") {
        this.data.dev = false;
        this.ws.send("Switched to production mode!");
        this.ws.send(streamEndToken);
        return;
      }

      const rand = Math.random();
      if (rand > 0.9) {
        this.ws.send("Hello, demo response message!");
        this.ws.send(streamEndToken);
      } else if (rand > 0.6) {
        let intv: number | NodeJS.Timer = 0;
        intv = setInterval(() => {
          this.ws.send(Math.random().toString(36).substring(2, 5));
        }, 50);
        setTimeout(() => {
          clearInterval(intv);
          this.ws.send(streamEndToken);
        }, 5000);
      } else if (rand > 0.3) {
        this.ws.send("\u0007");
        this.ws.send(streamEndToken);
      } else {
        this.ws.send("This is a paragraph");
        this.ws.send(streamEndToken);
        this.ws.send("This is another");
        this.ws.send(streamEndToken);
      }
      return;
    }

    this.data.messages.push({
      role: "user",
      content: e.data,
    });

    try {
      const chatCompletion = await this.openai.chat.completions.create({
        model: openaiChatModel,
        messages: this.data.messages,
        stream: true,
      });

      this.data.messages.push({
        role: "assistant",
        content: "",
      });

      for await (const chunk of chatCompletion) {
        const chunkContent = chunk.choices[0].delta.content;

        if (typeof chunkContent != "string") {
          continue;
        }

        this.data.messages[this.data.messages.length - 1].content +=
          chunkContent;

        // Split message newlines into different messages
        // A.K.A. chunking
        const lines = chunkContent.split(/(?:\r?\n){1,2}/);
        for (let _i in lines) {
          const i = parseInt(_i);

          this.ws.send(lines[i]);
          if (i < lines.length - 1) {
            this.ws.send(streamEndToken);
          }
        }
      }

      this.ws.send(streamEndToken);
    } catch (err) {
      console.error("Error in chatCompletion:", err);
    }
  }
}
