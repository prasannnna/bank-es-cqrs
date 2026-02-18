import { query } from "./index.js";
import { v4 as uuidv4 } from "uuid";
import { AggregateType } from "../domain/events.js";

export async function getLatestSnapshot(aggregateId) {
  const res = await query(
    `SELECT snapshot_data, last_event_number FROM snapshots WHERE aggregate_id=$1`,
    [aggregateId]
  );
  if (res.rows.length === 0) return null;

  return {
    state: res.rows[0].snapshot_data,
    lastEventNumber: res.rows[0].last_event_number,
  };
}

export async function getEventsAfter(aggregateId, afterEventNumber) {
  const res = await query(
    `SELECT * FROM events 
     WHERE aggregate_id=$1 AND event_number > $2
     ORDER BY event_number ASC`,
    [aggregateId, afterEventNumber]
  );
  return res.rows;
}

export async function getAllEvents(aggregateId) {
  const res = await query(
    `SELECT * FROM events WHERE aggregate_id=$1 ORDER BY event_number ASC`,
    [aggregateId]
  );
  return res.rows;
}

export async function getNextEventNumber(aggregateId) {
  const res = await query(
    `SELECT COALESCE(MAX(event_number),0) as max FROM events WHERE aggregate_id=$1`,
    [aggregateId]
  );
  return Number(res.rows[0].max) + 1;
}

export async function appendEvent(aggregateId, eventType, eventData, eventNumber) {
  const eventId = uuidv4();

  await query(
    `INSERT INTO events(event_id, aggregate_id, aggregate_type, event_type, event_data, event_number)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [eventId, aggregateId, AggregateType.BankAccount, eventType, eventData, eventNumber]
  );

  return eventId;
}

export async function saveSnapshot(aggregateId, state, lastEventNumber) {
  await query(
    `INSERT INTO snapshots(snapshot_id, aggregate_id, snapshot_data, last_event_number)
     VALUES(uuid_generate_v4(), $1, $2, $3)
     ON CONFLICT (aggregate_id)
     DO UPDATE SET snapshot_data=EXCLUDED.snapshot_data,
                   last_event_number=EXCLUDED.last_event_number,
                   created_at=NOW()`,
    [aggregateId, state, lastEventNumber]
  );
}
