# Robot Control Backend API

The backend captures event outcomes for later analysis. It is separate from the live robot bridge and does not actuate hardware.

## Event record flow

1. Sign in to receive a JWT.
2. Create a control session.
3. Post validated event snapshots, telemetry, device states, and command results under that session.
4. Read the session's event history by cursor.

PostgreSQL stores the account/session relationship. MongoDB stores the event documents. An acknowledgement means the event was accepted by MongoDB; it does not mean a physical command succeeded. The caller should record the later `command_result` event separately.

Voice records can include recognition status, language, and duration, but not audio bytes or transcript text. Never put secrets or arbitrary user text in `eventName` or `data`.
