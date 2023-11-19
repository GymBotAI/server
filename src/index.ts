import { Router } from "itty-router";

import { isDevelopment } from "./consts";
import * as routes from "./routes";

const router = Router();

router.get("/chat", routes.chat);
router.post("/workout", routes.workout);

export default {
  async fetch(req: Request) {
    return router.handle(req);
  },
};

if (isDevelopment) {
  console.warn("In development mode!");
} else {
  console.log("In production mode!");
}
