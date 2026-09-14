# Distribution Pagination Specification

## Purpose

Paginated, tenant-scoped list endpoints replacing capped queries (sales history today is `take 500`).

## Requirements

### Requirement: Paginated list endpoints

List endpoints (sales history, customers, POs, inventory) MUST support page/cursor and limit with tenant-scoped queries (today sales history is capped at `take 500`).

#### Scenario: Page through history

- GIVEN more sales than the page size
- WHEN page 2 is requested
- THEN the next slice returns with has-more metadata

#### Scenario: Out-of-range page

- GIVEN a page beyond the last records
- WHEN requested
- THEN an empty list returns (no error)

#### Scenario: Invalid pagination params

- GIVEN a limit outside allowed bounds
- WHEN requested
- THEN the server responds 400