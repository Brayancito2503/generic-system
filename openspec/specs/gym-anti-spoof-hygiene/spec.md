# Gym Anti-Spoof Hygiene Specification

## Purpose

Remove the client-hardcoded gym `tenantId` and derive it from the session; no new gym features are built in this change.

## Requirements

### Requirement: Gym tenantId from session, no client hardcode

The hardcoded `tenantId="powerfit-gym"` in `dashboard/modules/gym/page.tsx` and the default param in `GymCheckInView.tsx` MUST be removed; the gym page MUST derive tenantId server-side from the session. No new gym features are built in this change.

#### Scenario: Session-derived tenant

- GIVEN an authenticated gym tenant session
- WHEN the gym page loads
- THEN the tenantId used comes from the session, never from the client

#### Scenario: No client-supplied tenant

- GIVEN the gym check-in view
- WHEN it calls a backend
- THEN the request carries no client-provided tenantId