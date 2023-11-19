import { Router } from "itty-router";

import * as routes from "./routes";
import { isDev as getIsDev } from "./utils/isDev";

const router = Router();

router.get("/", routes.root);
router.get("/chat", routes.chat);
router.post("/workout", routes.workout);

let hasWarnedDev = false;
let isDev: null | boolean = null;

export default {
  async fetch(req: Request, env: Env) {
    if (!hasWarnedDev) {
      isDev = getIsDev(env);

      if (isDev) {
        console.warn("In development mode!");
      } else {
        console.log("In production mode!");
      }

      hasWarnedDev = true;
    }

    return router.handle(req, env, isDev);
  },
};
