import net from "node:net";
if (net.setDefaultAutoSelectFamily) {
  net.setDefaultAutoSelectFamily(false);
}

import app from "../backend/server.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default app;
