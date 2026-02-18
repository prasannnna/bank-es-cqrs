# Bank Account Management System (Event Sourcing + CQRS)

This project is a backend REST API for a Bank Account Management System implemented using **Event Sourcing** and **CQRS**.

- **Write model**: stored as immutable events in the `events` table.
- **Read model**: stored as projections in `account_summaries` and `transaction_history`.
- **Snapshots**: stored in `snapshots` every 50 events per account for faster aggregate loading.
- Fully containerized using **Docker + Docker Compose**.

---

## Tech Stack

- Node.js (Express)
- PostgreSQL 15
- Docker + Docker Compose

---

## Project Structure

```
bank-es-cqrs/
  seeds/
    001_schema.sql
  src/
    db/
    domain/
    projections/
    routes/
    app.js
    server.js
  docker-compose.yml
  Dockerfile
  .env.example
  submission.json
  package.json
  package-lock.json
  README.md


```
## Setup & Run

### 1) Create `.env`

Copy `.env.example` into `.env`:

```env
API_PORT=8080

DB_USER=user
DB_PASSWORD=password
DB_NAME=bank_db

DATABASE_URL=postgresql://user:password@db:5432/bank_db
```

### 2) Run with Docker Compose
```
docker-compose up --build
```
- Default API runs on `http://localhost:8080`
### To stop containers:

```bash
docker-compose down
```

### Expected:

- db becomes healthy

- app becomes healthy

- API runs on port 8080 (or API_PORT)

## Health Check

### GET /health

### Response:
```
{ "ok": true }
```
## Database Tables
### Event Store

- events

### Snapshots

- snapshots

### Read Model Projections

- account_summaries

- transaction_history

### Projection Tracking

- projection_checkpoints

## API Endpoints
### Command Endpoints (Write Side)
## 1) Create Account

### POST /api/accounts

Body:
```
{
  "accountId": "string",
  "ownerName": "string",
  "initialBalance": 0,
  "currency": "USD"
}
```
### Responses:

- 202 Accepted

- 400 Bad Request

- 409 Conflict

## 2) Deposit Money

- POST /api/accounts/{accountId}/deposit

Body:
```
{
  "amount": 100.50,
  "description": "string",
  "transactionId": "string"
}
```

### Responses:

- 202 Accepted

- 400 Bad Request

- 404 Not Found

- 409 Conflict

## 3) Withdraw Money

- POST /api/accounts/{accountId}/withdraw

Body:
```
{
  "amount": 50.00,
  "description": "string",
  "transactionId": "string"
}
```

### Responses:

- 202 Accepted

- 400 Bad Request

- 404 Not Found

- 409 Conflict

## 4) Close Account

- POST /api/accounts/{accountId}/close

Body:
```
{
  "reason": "string"
}
```
### Rules:

Can only close if balance is 0.

### Responses:

- 202 Accepted

- 404 Not Found

- 409 Conflict

### Query Endpoints (Read Side)
### 1) Get Current Account State

- GET /api/accounts/{accountId}

Response:
```
{
  "accountId": "string",
  "ownerName": "string",
  "balance": 150.5,
  "currency": "USD",
  "status": "OPEN"
}
```
### 2) Get Full Event Stream

- GET /api/accounts/{accountId}/events

Response:
```
[
  {
    "eventId": "uuid",
    "eventType": "AccountCreated",
    "eventNumber": 1,
    "data": {},
    "timestamp": "iso-8601-string"
  }
]
```
### 3) Time Travel Balance Query

- GET /api/accounts/{accountId}/balance-at/{timestamp}

timestamp must be ISO 8601 and URL encoded.

Response:
```
{
  "accountId": "string",
  "balanceAt": 100.0,
  "timestamp": "iso-8601-string"
}
```
### 4) Paginated Transaction History

- GET /api/accounts/{accountId}/transactions?page=1&pageSize=10

Response:
```
{
  "currentPage": 1,
  "pageSize": 10,
  "totalPages": 1,
  "totalCount": 2,
  "items": [
    {
      "transactionId": "uuid",
      "type": "DEPOSIT",
      "amount": 100.0,
      "description": "Initial deposit",
      "timestamp": "iso-8601-string"
    }
  ]
}
```
## Projections Admin Endpoints
### 1) Rebuild Projections

- POST /api/projections/rebuild

Response:
```
{
  "message": "Projection rebuild initiated."
}
```
### 2) Projections Status

- GET /api/projections/status

Response:
```
{
  "totalEventsInStore": 150,
  "projections": [
    {
      "name": "AccountSummaries",
      "lastProcessedEventNumberGlobal": 150,
      "lag": 0
    },
    {
      "name": "TransactionHistory",
      "lastProcessedEventNumberGlobal": 150,
      "lag": 0
    }
  ]
}
```
### Snapshotting

- Snapshots are created automatically for an account after every 50 events.

### Snapshots are stored in:

- snapshots.aggregate_id

- snapshots.last_event_number

- snapshots.snapshot_data

### Notes

- Projections are updated synchronously after each event commit.

- Read model endpoints never query the event store directly (except auditing and time-travel endpoints).

- Docker Compose initializes database schema automatically from **seeds/001_schema.sql**.