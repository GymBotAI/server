export default {
  host: process.env.GYMBOT_SERVER_DB_HOST || "localhost",
  database: "gymbot",
  user: process.env.GYMBOT_SERVER_DB_USER || "admindb",
  password: process.env.GYMBOT_SERVER_DB_PASSWORD || "Password",
};
