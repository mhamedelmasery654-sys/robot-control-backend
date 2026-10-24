# Task 8 — Robot Control Backend Demo

Demo sequence for a screen recording or project presentation:

1. Start PostgreSQL and MongoDB, then run `npm start`.
2. In Postman, check **Health → Readiness**.
3. Register an operator or sign in.
4. Create a session, post a button event and a telemetry/command-result event.
5. List events and show that MongoDB returned the stored event IDs and timestamps.
6. Close the session; verify that a later event is rejected with `SESSION_CLOSED`.

This demonstration records synthetic Postman inputs only. It does not connect to or move the physical robot.
