import express from "express";
import { EventType } from "../domain/events.js";
import { replayEvents } from "../domain/bankAccount.js";
import {
  appendEvent,
  getLatestSnapshot,
  getEventsAfter,
  getNextEventNumber,
  saveSnapshot,
} from "../db/schema.js";
import { projectEvent } from "../projections/projector.js";

export const commandsRouter = express.Router();

async function loadAccount(aggregateId) {
  const snapshot = await getLatestSnapshot(aggregateId);
  const after = snapshot ? snapshot.lastEventNumber : 0;
  const events = await getEventsAfter(aggregateId, after);

  const state = replayEvents(
    aggregateId,
    events,
    snapshot ? { ...snapshot.state, processedTransactionIds: new Set() } : null
  );

  return { state, eventsCountSinceSnapshot: events.length, snapshotLast: after };
}

async function maybeSnapshot(accountId, state) {
  // snapshot after every 50 events
  if (state.version > 0 && state.version % 50 === 0) {
    const safeState = {
      accountId: state.accountId,
      ownerName: state.ownerName,
      balance: state.balance,
      currency: state.currency,
      status: state.status,
    };
    await saveSnapshot(accountId, safeState, state.version);
  }
}

// HEALTH
commandsRouter.get("/health", (req, res) => res.json({ ok: true }));

// CREATE ACCOUNT
commandsRouter.post("/api/accounts", async (req, res) => {
  try {
    const { accountId, ownerName, initialBalance, currency } = req.body;

    if (!accountId || !ownerName || currency == null || initialBalance == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (Number(initialBalance) < 0) {
      return res.status(400).json({ error: "initialBalance must be >= 0" });
    }

    const { state } = await loadAccount(accountId);
    if (state.status !== "NONE") {
      return res.status(409).json({ error: "Account already exists" });
    }

    const eventNumber = await getNextEventNumber(accountId);

    const eventData = {
      ownerName,
      initialBalance: Number(initialBalance),
      currency,
    };

    const eventId = await appendEvent(accountId, EventType.AccountCreated, eventData, eventNumber);

    const eventRow = {
      aggregate_id: accountId,
      event_type: EventType.AccountCreated,
      event_data: eventData,
      event_number: eventNumber,
      timestamp: new Date().toISOString(),
      event_id: eventId,
    };

    await projectEvent(eventRow);

    return res.status(202).json({ message: "Account creation accepted." });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
});

// DEPOSIT
commandsRouter.post("/api/accounts/:accountId/deposit", async (req, res) => {
  try {
    const { accountId } = req.params;
    const { amount, description, transactionId } = req.body;

    if (!transactionId || amount == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: "amount must be > 0" });
    }

    const { state } = await loadAccount(accountId);

    if (state.status === "NONE") return res.status(404).json({ error: "Account not found" });
    if (state.status === "CLOSED") return res.status(409).json({ error: "Account closed" });

    const eventNumber = await getNextEventNumber(accountId);

    const eventData = {
      amount: Number(amount),
      description: description ?? null,
      transactionId,
    };

    const eventId = await appendEvent(accountId, EventType.MoneyDeposited, eventData, eventNumber);

    const eventRow = {
      aggregate_id: accountId,
      event_type: EventType.MoneyDeposited,
      event_data: eventData,
      event_number: eventNumber,
      timestamp: new Date().toISOString(),
      event_id: eventId,
    };

    await projectEvent(eventRow);

    state.balance += Number(amount);
    state.version = eventNumber;

    await maybeSnapshot(accountId, state);

    return res.status(202).json({ message: "Deposit accepted." });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
});

// WITHDRAW
commandsRouter.post("/api/accounts/:accountId/withdraw", async (req, res) => {
  try {
    const { accountId } = req.params;
    const { amount, description, transactionId } = req.body;

    if (!transactionId || amount == null) {
      return res.status(400).json({ error: "Missing fields" });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: "amount must be > 0" });
    }

    const { state } = await loadAccount(accountId);

    if (state.status === "NONE") return res.status(404).json({ error: "Account not found" });
    if (state.status === "CLOSED") return res.status(409).json({ error: "Account closed" });

    if (state.balance - Number(amount) < 0) {
      return res.status(409).json({ error: "Insufficient funds" });
    }

    const eventNumber = await getNextEventNumber(accountId);

    const eventData = {
      amount: Number(amount),
      description: description ?? null,
      transactionId,
    };

    const eventId = await appendEvent(accountId, EventType.MoneyWithdrawn, eventData, eventNumber);

    const eventRow = {
      aggregate_id: accountId,
      event_type: EventType.MoneyWithdrawn,
      event_data: eventData,
      event_number: eventNumber,
      timestamp: new Date().toISOString(),
      event_id: eventId,
    };

    await projectEvent(eventRow);

    state.balance -= Number(amount);
    state.version = eventNumber;

    await maybeSnapshot(accountId, state);

    return res.status(202).json({ message: "Withdraw accepted." });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
});

// CLOSE
commandsRouter.post("/api/accounts/:accountId/close", async (req, res) => {
  try {
    const { accountId } = req.params;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ error: "reason is required" });

    const { state } = await loadAccount(accountId);

    if (state.status === "NONE") return res.status(404).json({ error: "Account not found" });
    if (state.status === "CLOSED") return res.status(409).json({ error: "Already closed" });

    if (Number(state.balance) !== 0) {
      return res.status(409).json({ error: "Balance must be zero to close account" });
    }

    const eventNumber = await getNextEventNumber(accountId);

    const eventData = { reason };

    const eventId = await appendEvent(accountId, EventType.AccountClosed, eventData, eventNumber);

    const eventRow = {
      aggregate_id: accountId,
      event_type: EventType.AccountClosed,
      event_data: eventData,
      event_number: eventNumber,
      timestamp: new Date().toISOString(),
      event_id: eventId,
    };

    await projectEvent(eventRow);

    return res.status(202).json({ message: "Account closed." });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
});
