import WsHandler from "./ws";

export default async function handler(req: Request) {
  const upgradeHeader = req.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  const ip = req.headers.get("cf-connecting-ip");

  if (!ip) {
    return new Response("Expected IP", { status: 500 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  const wsHandler = new WsHandler(server, ip);

  server.accept();
  server.addEventListener("open", wsHandler.onOpen);
  server.addEventListener("message", wsHandler.onMessage);
  server.addEventListener("close", wsHandler.onClose);

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}
