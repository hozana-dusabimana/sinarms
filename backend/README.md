# SINARMS Backend

Node/Express backend for SINARMS with:

- JWT auth
- role and permission checks
- visitor lifecycle endpoints
- organization/location/user/FAQ/map management
- audit log and alerts
- Socket.IO event emission
- hardcoded AI service endpoints under `/ai/*`
- MySQL persistence with SQL migrations that auto-run on startup

## Run

```bash
npm install
npm run migrate
npm start
```

Default server:

- `http://localhost:4000`

Default database connection if you do not override env vars:

- host: `127.0.0.1`
- port: `3306`
- user: `root`
- password: empty
- database: `sinarms`

You can override that with either:

- `DATABASE_URL=mysql://user:password@host:3306/sinarms`

or

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

The backend boot path automatically does all of this:

1. Creates the MySQL database if it does not exist.
2. Applies every SQL file under [backend/src/data/migrations](d:/XAMPP/htdocs/sinarms/backend/src/data/migrations).
3. Seeds the initial SINARMS data if the schema is empty.
4. Starts the API server.

This means if you run `npm start`, the required tables are created immediately before the server begins serving requests.

## Tables Created

- `schema_migrations`
- `organizations`
- `locations`
- `users`
- `visitors`
- `visitor_positions`
- `map_nodes`
- `map_edges`
- `alerts`
- `chatbot_faq`
- `audit_log`
- `analytics_daily`
- `notifications`

## Demo Accounts

- `admin@ruliba.rw` / `Admin123!`
- `reception@ruliba.rw` / `Reception123!`

## Tests

Runs integration tests against MySQL. If MySQL is not reachable, tests are skipped (gracefully).

```bash
npm test
```

Optional overrides (defaults shown):

- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_USER=root`
- `DB_PASSWORD=`
- `DB_NAME=sinarms_test`

## Key Routes

- `POST /api/auth/login`
- `POST /api/visitors/checkin`
- `GET /api/visitors/active`
- `GET /api/analytics/summary`
- `GET /api/organizations`
- `GET /api/locations/:id/map`
- `POST /api/chatbot/query`
- `POST /ai/classify-intent`
- `POST /ai/calculate-route`
- `POST /ai/chatbot`
