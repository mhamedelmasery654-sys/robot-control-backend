# Robot Control Backend — Task 8 structure

Standalone backend package for the robot-control website. Its folder layout follows the supplied Task 8 Blog API project (`controllers`, `entities`, `middleware`, `repositories`, `routes`, `services`, `validators`, `public`, `postman`, and `test`), adapted to control-session history and event/result recording.

This package is separate from `gamepad-calibration-kit`. It does not open a serial port, connect to an ESP32/Arduino, drive motors, or modify the existing robot website. It accepts authenticated, validated records and returns storage acknowledgements.

## Storage responsibilities

- **PostgreSQL + TypeORM:** users, roles, control-session ownership/lifecycle, and administrative audit records.
- **MongoDB + Mongoose:** sanitized button/stick/trigger events, device/controller status, voice processing status, robot status, telemetry snapshots, and command results.
- **Postman:** the current local project uses the v3 collection at `postman/collections/Robot Control Backend/` and environment at `postman/environments/Robot Control Backend - Local.environment.yaml`. In Postman Local Mode, open this project folder and select **Robot Control Backend - Local** from the environment picker.

The event schema is allow-listed and strict. It rejects unknown payload fields, including raw audio and speech transcripts. Passwords are hashed; tokens and request bodies are not written to event logs. MongoDB removes stored events after `EVENT_RETENTION_DAYS` (90 by default).

## Project layout

```text
robot-control-backend/
├── .postman/
├── postman/
│   ├── collections/                # Native v3 YAML collection and request files
│   ├── documents/
│   ├── environments/               # Local v3 YAML environment
│   ├── flows/
│   ├── globals/
│   ├── mocks/
│   └── specs/
├── public/                         # Small service-status page, not the robot control UI
├── src/
│   ├── controllers/
│   ├── entities/                   # PostgreSQL entities + Mongo event schema
│   ├── middleware/
│   ├── notes/                      # Kept to match the Task 8 scaffold; no notes data is stored
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── validators/
│   ├── migrations/
│   ├── app.js
│   ├── config.js
│   ├── db.js
│   ├── server.js
│   └── websocket.js
├── test/
├── scripts/
├── .env.example
├── render.yaml                    # Render Docker service blueprint
├── DEPLOYMENT.md                  # Hosted-service setup and deployment sequence
├── Admin-Panel-Test-Report.md
├── README-execution-report.md
├── package.json
├── schema.sql
└── README.md
```

The reference bundle's `.env`, `.git`, and `node_modules` were deliberately not copied. This project has its own clean environment template and lockfile.

## Local setup

Requirements: Node.js 20+, PostgreSQL, MongoDB Community Server, and Postman.

1. Install the Node dependencies in this folder:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env`. Set the local PostgreSQL password and generate a unique `JWT_SECRET` with at least 32 characters. Keep `.env` private.

3. Create a PostgreSQL database named by `DB_NAME` (default `robot_control_backend`). Apply the versioned migration:

   ```powershell
   npm run db:migrate
   ```

4. On Windows, install MongoDB Community Server with the MSI and keep **Install MongoD as a Service** enabled. The default Windows service account (`Network Service`) is only the identity that runs the service; it does not expose the database to the LAN. Keep MongoDB bound to `127.0.0.1` for this local phase. The API URI in `.env` uses `mongodb://127.0.0.1:27017/robot_control_backend`.

5. Start the API:

   ```powershell
   npm start
   ```

5. Open `http://127.0.0.1:8787/`. The status page distinguishes API liveness from database readiness. `GET /api/v1/health/ready` returns HTTP 503 until both databases are reachable.

Confirm local-only MongoDB binding in `C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg` (`net.bindIp: 127.0.0.1`) before using real data. Do not bind to `0.0.0.0` or add a router port-forward for this development setup.

## First admin account

Registration creates an `operator`, never an admin. To create or promote the initial administrator, set these variables in the current PowerShell window and run the one-time script:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com'
$env:BOOTSTRAP_ADMIN_PASSWORD = 'use-a-private-password-at-least-12-characters'
npm run admin:create
Remove-Item Env:\BOOTSTRAP_ADMIN_EMAIL, Env:\BOOTSTRAP_ADMIN_PASSWORD
```

The script applies pending PostgreSQL migrations and records the bootstrap action. It prints only the admin ID and email, never the password.

## API outline

All HTTP endpoints are under `/api/v1`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health/live` | API process liveness |
| `GET` | `/health/ready` | PostgreSQL + MongoDB readiness |
| `POST` | `/auth/register` | Create an operator account |
| `POST` | `/auth/login` | Sign in and receive a short-lived JWT |
| `GET` | `/auth/me` | Read the authenticated profile |
| `POST` | `/sessions` | Start an owned control session |
| `GET` | `/sessions` | List the caller's sessions |
| `GET` | `/sessions/:sessionId` | Read an owned session |
| `POST` | `/sessions/:sessionId/close` | Close an active session |
| `POST` | `/sessions/:sessionId/events` | Persist a validated event/result in MongoDB |
| `GET` | `/sessions/:sessionId/events` | Read event history using a cursor |
| `GET` | `/admin/users` | Admin-only user list without password hashes |
| `GET` | `/admin/audit` | Admin-only audit history |
| `WS` | `/api/v1/ws` | Authenticated, event-only live ingestion |

Event categories are `control_input`, `device_status`, `controller_selection`, `voice_status`, `robot_status`, `telemetry`, and `command_result`. Each category has a bounded, strict payload schema. Duplicate `eventId` values are idempotently acknowledged. Events are accepted only while their session is active.

### WebSocket handshake

Connect to `ws://127.0.0.1:8787/api/v1/ws`. Send first:

```json
{"type":"auth","token":"<JWT>","sessionId":"<session UUID>"}
```

After a `ready` response, send:

```json
{"type":"event","event":{"source":"gamepad","category":"control_input","eventName":"button.pressed","data":{"buttonsPressed":["A"]}}}
```

The server returns `event_ack` only after MongoDB accepts the event. This socket does not broadcast actuator commands or drive hardware. It is a backend ingestion endpoint for future frontend integration.

## Verification

```powershell
npm run check
npm test
```

The test suite uses mocked services and validates API behavior and payload boundaries without connecting to the robot or requiring either database. Postman live database checks require PostgreSQL and MongoDB to be running.

## Deployment notes

- Use HTTPS/WSS at the public reverse proxy or tunnel; set `HOST=0.0.0.0` only for a managed host/container.
- Set `NODE_ENV=production`, strong secrets, managed database URLs, and an explicit comma-separated `PUBLIC_ORIGINS` allow-list. Temporary tunnel domains must be included while in use.
- Run `npm run db:migrate` as a deployment step; `RUN_MIGRATIONS` defaults to `false` so application startup does not silently change the relational schema.
- Give the runtime MongoDB account only the required collection/index permissions. Event TTL is configured when the service starts.
- A tunnel provides a public route, not production availability, authentication hardening, backups, or database hosting. Use managed services and backups before a worldwide launch.

The Render Blueprint and provider-specific setup are in [DEPLOYMENT.md](DEPLOYMENT.md). A hosted API requires both PostgreSQL and MongoDB; a Neon PostgreSQL URL is supported through `DATABASE_URL`.

See `postman/documents/API Overview.md` and `postman/specs/openapi.yaml` for the API contract. `Task 8 - Robot Control Backend Demo/README.md` is a compact presentation/demo checklist.
