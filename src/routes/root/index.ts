export default function handler(req: Request, env: Env, isDev: boolean) {
  return new Response("Hi", {
    headers: isDev
      ? {
          "x-gymbot-dev": "1",
        }
      : {},
  });
}
