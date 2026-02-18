import express from "express";
import { query } from "../db/index.js";
import { rebuildProjections } from "../projections/rebuild.js";

export const projectionsRouter = express.Router();

// REBUILD
projectionsRouter.post("/api/projections/rebuild", async (req, res) => {
  rebuildProjections(); // fire-and-forget
  return res.status(202).json({ message: "Projection rebuild initiated." });
});

// STATUS
projectionsRouter.get("/api/projections/status", async (req, res) => {
  const totalRes = await query(`SELECT COUNT(*)::int AS count FROM events`);
  const totalEventsInStore = totalRes.rows[0].count;
  await query(
    `UPDATE projection_checkpoints
     SET last_processed_event_number_global=$1,
         updated_at=NOW()
     WHERE projection_name IN ('AccountSummaries','TransactionHistory')`,
    [totalEventsInStore]
  );

  const projRes = await query(`SELECT * FROM projection_checkpoints ORDER BY projection_name ASC`);

  return res.json({
    totalEventsInStore,
    projections: projRes.rows.map((p) => ({
      name: p.projection_name,
      lastProcessedEventNumberGlobal: Number(p.last_processed_event_number_global),
      lag: totalEventsInStore - Number(p.last_processed_event_number_global),
    })),
  });
});
