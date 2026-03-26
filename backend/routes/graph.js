import { Router } from "express";
import { buildGraphJson, expandNode } from "../graph.js";

const router = Router();

router.get("/", (_, res) => {
  res.json(buildGraphJson());
});

router.get("/expand/:nodeId", (req, res) => {
  res.json(expandNode(req.params.nodeId));
});

export default router;