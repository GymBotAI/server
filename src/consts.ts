export const isDevelopment =
  !process.argv.includes("--prod") && process.env.NODE_ENV != "production";

export const streamEndToken = "[DONE]";
