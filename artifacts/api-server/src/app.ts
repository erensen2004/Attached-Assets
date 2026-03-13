import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

const app: Express = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (
        ALLOWED_ORIGINS.length === 0 ||
        ALLOWED_ORIGINS.includes(origin) ||
        origin.endsWith(".replit.dev") ||
        origin.endsWith(".repl.co") ||
        origin.endsWith(".pike.replit.dev")
      ) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy: origin not allowed"));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
