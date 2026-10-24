# Admin API Test Report

This backend includes admin-only API routes for listing safe user fields and reading audit events. It does not include an admin panel UI.

## Current result

- Admin routes require a valid bearer token with the `admin` role.
- User listing selects only ID, email, role, password-change flag, and creation timestamp; it does not return password hashes.
- Admin bootstrap is performed with `npm run admin:create` and credentials provided through temporary environment variables.
- Automated tests currently cover the liveness route, authenticated event ingestion, event payload rejection, and WebSocket persistence. They do not claim a live admin/database integration test.

Live admin verification can be performed in Postman after PostgreSQL is configured, the migration is applied, and an admin account is bootstrapped.
