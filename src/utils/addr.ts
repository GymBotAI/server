import { localIp } from "./ip";

import type { Server } from "bun";

export function getServerAddress(server: Server) {
  if (process.env.REPL_HOME) {
    return `https://${process.env.REPL_SLUG?.toLowerCase()}.${process.env.REPL_OWNER?.toLowerCase()}.repl.co`;
  } else if (localIp) {
    return `http://${localIp}:${server.port}`;
  } else {
    return `http://${server.hostname}:${server.port}`;
  }
}
