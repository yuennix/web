import { Router, type IRouter } from "express";
import { addSseClient, removeSseClient } from "../lib/sse";

const router: IRouter = Router();

router.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write("event: connected\ndata: {}\n\n");

  const client = addSseClient(res, req.query.address as string | undefined);

  req.on("close", () => {
    removeSseClient(client);
  });
});

export default router;
