import express from "express";
import { query } from "../db/index.js";
import { getAllEvents } from "../db/schema.js";
import { replayEvents, initialState } from "../domain/bankAccount.js";

export const queriesRouter = express.Router();

// GET ACCOUNT STATE (READ MODEL)
queriesRouter.get("/api/accounts/:accountId", async (req, res) => {
  const { accountId } = req.params;

  const result = await query(`SELECT * FROM account_summaries WHERE account_id=$1`, [accountId]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Account not found" });

  const row = result.rows[0];

  return res.json({
    accountId: row.account_id,
    ownerName: row.owner_name,
    balance: Number(row.balance),
    currency: row.currency,
    status: row.status,
  });
});

// GET EVENTS (AUDIT)
queriesRouter.get("/api/accounts/:accountId/events", async (req, res) => {
  const { accountId } = req.params;

  const events = await getAllEvents(accountId);

  // if account doesn't exist
  if (events.length === 0) return res.status(404).json({ error: "Account not found" });

  return res.json(
    events.map((e) => ({
      eventId: e.event_id,
      eventType: e.event_type,
      eventNumber: e.event_number,
      data: e.event_data,
      timestamp: e.timestamp,
    }))
  );
});

// TIME TRAVEL BALANCE
queriesRouter.get("/api/accounts/:accountId/balance-at/:timestamp", async (req, res) => {
  const { accountId, timestamp } = req.params;

  const t = new Date(decodeURIComponent(timestamp));
  if (isNaN(t.getTime())) return res.status(400).json({ error: "Invalid timestamp" });

  const result = await query(
  `SELECT * FROM events
   WHERE aggregate_id=$1
     AND timestamp < ($2::timestamptz + interval '1 second')
   ORDER BY event_number ASC`,
  [accountId, t.toISOString()]
  );


  if (result.rows.length === 0) return res.status(404).json({ error: "No events for account" });

  const state = replayEvents(accountId, result.rows, initialState(accountId));

  return res.json({
    accountId,
    balanceAt: Number(state.balance),
    timestamp: t.toISOString(),
  });
});

// PAGINATED TRANSACTIONS
queriesRouter.get("/api/accounts/:accountId/transactions", async (req, res) => {
  const { accountId } = req.params;

  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize ?? 10)));

  const countRes = await query(
    `SELECT COUNT(*)::int AS count FROM transaction_history WHERE account_id=$1`,
    [accountId]
  );

  const totalCount = countRes.rows[0].count;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const offset = (page - 1) * pageSize;

  const itemsRes = await query(
    `SELECT * FROM transaction_history
     WHERE account_id=$1
     ORDER BY timestamp ASC
     LIMIT $2 OFFSET $3`,
    [accountId, pageSize, offset]
  );

  return res.json({
    currentPage: page,
    pageSize,
    totalPages,
    totalCount,
    items: itemsRes.rows.map((r) => ({
      transactionId: r.transaction_id,
      type: r.type,
      amount: Number(r.amount),
      description: r.description,
      timestamp: r.timestamp,
    })),
  });
});
