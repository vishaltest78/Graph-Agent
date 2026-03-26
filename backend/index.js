import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDb } from "./db.js";
import graphRouter from "./routes/graph.js";
import chatRouter from "./routes/chat.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

initDb();

app.use("/api/graph", graphRouter);
app.use("/api/chat", chatRouter);

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port:${PORT}`));