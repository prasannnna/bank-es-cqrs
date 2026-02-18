import { EventType } from "./events.js";

export function initialState(accountId) {
  return {
    accountId,
    ownerName: null,
    balance: 0,
    currency: null,
    status: "NONE", 
    processedTransactionIds: new Set(),
    version: 0,
  };
}

export function applyEvent(state, event) {
  const { event_type, event_data, event_number } = event;

  switch (event_type) {
    case EventType.AccountCreated:
      state.ownerName = event_data.ownerName;
      state.balance = Number(event_data.initialBalance);
      state.currency = event_data.currency;
      state.status = "OPEN";
      break;

    case EventType.MoneyDeposited:
      state.balance += Number(event_data.amount);
      state.processedTransactionIds.add(event_data.transactionId);
      break;

    case EventType.MoneyWithdrawn:
      state.balance -= Number(event_data.amount);
      state.processedTransactionIds.add(event_data.transactionId);
      break;

    case EventType.AccountClosed:
      state.status = "CLOSED";
      break;
  }

  state.version = event_number;
  return state;
}

export function replayEvents(accountId, events, snapshot = null) {
  const state = snapshot ? snapshot : initialState(accountId);

  for (const ev of events) applyEvent(state, ev);
  return state;
}
