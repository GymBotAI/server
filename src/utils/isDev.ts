export function isDev(env: Env) {
  return env.PROD != "1";
}
