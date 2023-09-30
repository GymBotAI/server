export function getServerAddress(localIp: string, port: number) {
  if (process.env.REPLIT_HOME) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  } else {
    return `http://${localIp}:${port}`;
  }
}
