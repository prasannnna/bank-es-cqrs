import { query } from "../db/index.js";
import { projectEvent } from "./projector.js";

export async function rebuildProjections() {
  await query("DELETE FROM account_summaries");
  await query("DELETE FROM transaction_history");

  await query(
    `UPDATE projection_checkpoints
     SET last_processed_event_number_global=0, updated_at=NOW()`
  );

  const eventsRes = await query(`SELECT * FROM events ORDER BY timestamp ASC`);
  for (const ev of eventsRes.rows) {
    await projectEvent(ev);
  }

  // update checkpoints to latest global
  const total = eventsRes.rows.length;
  await query(
    `UPDATE projection_checkpoints
     SET last_processed_event_number_global=$1, updated_at=NOW()
     WHERE projection_name IN ('AccountSummaries','TransactionHistory')`,
    [total]
  );
}
