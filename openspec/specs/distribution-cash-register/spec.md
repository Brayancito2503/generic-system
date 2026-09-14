# Distribution Cash Register Specification

## Purpose

Server-side cash session close with a single-open-session guard and persisted movements; money math never trusts client values.

## Requirements

### Requirement: Server-side cash close with single open session

The close endpoint MUST compute totals and difference server-side from persisted movements plus the cashier's physical count; it MUST NOT trust client `expectedAmount`/`difference`. Opening a new cash session while one is open MUST fail with 409.

#### Scenario: Honest close

- GIVEN an open cash session with persisted movements
- WHEN the cashier submits a physical count
- THEN the server computes expected total and difference and persists the close record

#### Scenario: Duplicate open session

- GIVEN an already-open cash session for the tenant
- WHEN a new open request arrives
- THEN the server responds 409 and does not create a second session

#### Scenario: Tampered client values

- GIVEN a close request whose body claims a fabricated `expectedAmount`/`difference`
- WHEN the server closes the session
- THEN server-derived totals override the client values