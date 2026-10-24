# Robot Control Backend

A standalone backend for recording robot-control sessions, input events, status updates, telemetry snapshots, and command results.

This service stores records for a future connection to the robot-control website. It does **not** send commands to the robot, control motors, open a serial port, or connect to an ESP32 or Arduino.

## Project Owner

**Khaled Mohamed Ahmed El-Sayed El-Masry**  
Third-year student, Faculty of Engineering  
Electrical Power Quality Department

This is an individual engineering project created and managed by Khaled.

## Project Links

- **Live project page:** [robot-control-backend.onrender.com](https://robot-control-backend.onrender.com/)
- **API readiness:** [Check service and database status](https://robot-control-backend.onrender.com/api/v1/health/ready)
- **API liveness:** [Check whether the API process is running](https://robot-control-backend.onrender.com/api/v1/health/live)
- **GitHub source repository:** [robot-control-backend](https://github.com/mhamedelmasery654-sys/robot-control-backend)
- **Project owner profile:** [GitHub profile](https://github.com/mhamedelmasery654-sys)
- **Render service dashboard:** [Open service settings and logs](https://dashboard.render.com/web/srv-dbecidm7bikc7380h1c0) — requires access to the Render workspace.

 > The live service links are public. GitHub source, Postman, and deployment-guide links follow the repository's visibility settings.

## Current Deployment

The service runs on Render as a Docker web service in Frankfurt. It is connected to the `main` branch of this repository.

On 24 October 2026, these live checks succeeded:

- The project page returned HTTP 200.
- The readiness endpoint returned HTTP 200.
- PostgreSQL reported `up`.
- MongoDB reported `up`.

Atlas network access is restricted to the laptop address and the Frankfurt outbound ranges used by this Render service. No open-to-everywhere database rule was added.

Render's service-level HTTP health-check field still needs to be set to `/api/v1/health/ready`. The endpoint itself was checked successfully, but Render's automatic health check is not yet configured to use it.

## Technology

- Node.js and Express for the HTTP API.
- PostgreSQL and TypeORM for users, roles, sessions, and administrative audit records.
- MongoDB and Mongoose for validated event and telemetry records.
- JSON Web Tokens (JWT) for authenticated API access.
- WebSockets for authenticated live event ingestion.
- Zod for strict request validation.
- Docker and Render for deployment.
- Postman and OpenAPI for API documentation and request workflows.

## What the Backend Records

The API accepts events only for an authenticated, active control session. Supported event categories include:

- Controller inputs
- Device and controller status
- Voice-processing status
- Robot status
- Telemetry snapshots
- Command results

The event schema is strict and rejects unknown fields. Raw audio and speech transcripts are not accepted. Duplicate event IDs are acknowledged safely. Stored events expire after 90 days by default.

## API Overview

The API base URL is:

```text
https://robot-control-backend.onrender.com/api/v1
```

Main routes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health/live` | Check that the API process is running |
| GET | `/health/ready` | Check PostgreSQL and MongoDB connections |
| POST | `/auth/register` | Create an operator account |
| POST | `/auth/login` | Sign in and receive a JWT |
| GET | `/auth/me` | Read the signed-in user's profile |
| POST | `/sessions` | Start a control session |
| GET | `/sessions` | List the signed-in user's sessions |
| POST | `/sessions/:sessionId/close` | Close a session |
| POST | `/sessions/:sessionId/events` | Save a validated event |
| GET | `/sessions/:sessionId/events` | Read session event history |
| GET | `/admin/users` | Admin-only user list |
| GET | `/admin/audit` | Admin-only audit history |
| WebSocket | `/api/v1/ws` | Authenticated event ingestion |

The WebSocket acknowledges an event after MongoDB accepts it. It is for recording events; it does not broadcast motor or actuator commands.

## Postman and API Contract

- [OpenAPI specification](https://github.com/mhamedelmasery654-sys/robot-control-backend/blob/main/postman/specs/openapi.yaml)
- [Postman collection folder](https://github.com/mhamedelmasery654-sys/robot-control-backend/tree/main/postman/collections/Robot%20Control%20Backend)
- [Local Postman environment](https://github.com/mhamedelmasery654-sys/robot-control-backend/blob/main/postman/environments/Robot%20Control%20Backend%20-%20Local.environment.yaml)
- [Deployment guide](https://github.com/mhamedelmasery654-sys/robot-control-backend/blob/main/DEPLOYMENT.md)
- [Execution report](https://github.com/mhamedelmasery654-sys/robot-control-backend/blob/main/README-execution-report.md)

These files are stored in this repository; access follows the repository's visibility setting.

## Local Development

Requirements: Node.js 20 or newer, PostgreSQL, MongoDB, and Postman.

1. Install packages:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and set local database URLs and a unique JWT secret. Never commit `.env`.

3. Start PostgreSQL and MongoDB locally, then apply the database migration:

   ```powershell
   npm run db:migrate
   ```

4. Start the API:

   ```powershell
   npm start
   ```

5. Open [http://127.0.0.1:8787/](http://127.0.0.1:8787/).

Useful commands:

- `npm run check` — check JavaScript syntax.
- `npm test` — run the automated test suite.
- `npm run admin:create` — create the initial administrator using temporary environment variables.

## Configuration and Security

Set these values in the hosting provider's secret environment settings:

- `DATABASE_URL`
- `MONGODB_URI`
- `JWT_SECRET`
- `PUBLIC_ORIGINS`

The service also uses `NODE_ENV`, `HOST`, and `RUN_MIGRATIONS`. Never put real passwords, database URLs, or JWT values in GitHub or Postman files.

**Security follow-up:** The current MongoDB Atlas runtime credential has broader access than the application needs. Replace it with a dedicated least-privilege database user before using this service for production data.

## Verification History

The project execution report records these local checks:

- `npm run check`: passed; 44 JavaScript files parsed.
- `npm test`: 11 passed, 0 failed.
- Postman collection and environment lint: 0 errors and 0 warnings.
- PostgreSQL migration and smoke check: passed.
- Live Render readiness check: HTTP 200; PostgreSQL and MongoDB both reported `up`.

## Project Scope

This is a backend logging and session API. It is not the existing robot-control website, and it is not connected to the physical robot or its firmware yet. A future frontend integration can send authenticated session events to this API.

