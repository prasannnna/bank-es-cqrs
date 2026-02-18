import { query } from "../db/index.js";
import { EventType } from "../domain/events.js";

export async function projectEvent(event) {
  const { aggregate_id, event_type, event_data, event_number, timestamp } = event;

  // ACCOUNT SUMMARY projection
  if (event_type === EventType.AccountCreated) {
    await query(
      `INSERT INTO account_summaries(account_id, owner_name, balance, currency, status, version)
       VALUES($1,$2,$3,$4,'OPEN',$5)
       ON CONFLICT (account_id) DO NOTHING`,
      [aggregate_id, event_data.ownerName, event_data.initialBalance, event_data.currency, event_number]
    );
  }

  if (event_type === EventType.MoneyDeposited) {
    await query(
      `UPDATE account_summaries
       SET balance = balance + $1, version=$2
       WHERE account_id=$3`,
      [event_data.amount, event_number, aggregate_id]
    );

    await query(
      `INSERT INTO transaction_history(transaction_id, account_id, type, amount, description, timestamp)
       VALUES($1,$2,'DEPOSIT',$3,$4,$5)
       ON CONFLICT (transaction_id) DO NOTHING`,
      [event_data.transactionId, aggregate_id, event_data.amount, event_data.description ?? null, timestamp]
    );
  }

  if (event_type === EventType.MoneyWithdrawn) {
    await query(
      `UPDATE account_summaries
       SET balance = balance - $1, version=$2
       WHERE account_id=$3`,
      [event_data.amount, event_number, aggregate_id]
    );

    await query(
      `INSERT INTO transaction_history(transaction_id, account_id, type, amount, description, timestamp)
       VALUES($1,$2,'WITHDRAW',$3,$4,$5)
       ON CONFLICT (transaction_id) DO NOTHING`,
      [event_data.transactionId, aggregate_id, event_data.amount, event_data.description ?? null, timestamp]
    );
  }

  if (event_type === EventType.AccountClosed) {
    await query(
      `UPDATE account_summaries SET status='CLOSED', version=$1 WHERE account_id=$2`,
      [event_number, aggregate_id]
    );
  }
}
