# Admin Tenant Settings Specification

## Purpose

TENANT_ADMIN-only tenant settings administration persisted to `Tenant.settings` via validated, tenant-scoped endpoints (no admin section exists today).

## Requirements

### Requirement: Tenant settings administration

A TENANT_ADMIN-only settings section MUST allow editing tenant-level configuration persisted to `Tenant.settings` (name/identity, fiscal data, branding/feature flags) via validated, tenant-scoped endpoints.

#### Scenario: Update tenant settings

- GIVEN a TENANT_ADMIN session
- WHEN settings are edited and saved
- THEN `Tenant.settings` persists and the shell reflects the change

#### Scenario: Role denial

- GIVEN a STAFF session
- WHEN the settings route is called
- THEN the server responds 403

#### Scenario: Invalid settings payload

- GIVEN a settings payload with invalid typed fields
- WHEN submitted
- THEN the server responds 400 and nothing changes