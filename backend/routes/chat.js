import { Router } from "express";
import { processQuery } from "../llm.js";

const router = Router();

router.post("/", async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: "Empty message" });

  try {
    const result = await processQuery(message);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal error", detail: err.message });
  }
});

export default router;