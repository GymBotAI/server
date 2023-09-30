import type { Server } from "bun";

export function getServerAddress(localIp: string | null, server: Server) {
  if (process.env.REPLIT_HOME) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  } else if (localIp) {
    return `http://${localIp}:${server.port}`;
  } else {
    return `http://${server.hostname}:${server.port}`;
  }
}