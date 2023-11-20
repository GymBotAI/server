import WsHandler from "./ws";

export default async function handler(req: Request, env: Env, isDev: boolean) {
  const ip = req.headers.get("cf-connecting-ip");

  if (!ip) {
    return new Response("Expected IP", { status: 500 });
  }

  const upgradeHeader = req.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  const wsHandler = new WsHandler(server, ip, env, isDev);

  server.accept();
  server.addEventListener("message", wsHandler.onMessage);
  server.addEventListener("close", wsHandler.onClose);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
