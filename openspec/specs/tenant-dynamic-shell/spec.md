# Tenant Dynamic Shell Specification

## Purpose

Sidebar and header derived from the session, `tenant.modules`, and role; real tenant name; no hardcoded tabs.

## Requirements

### Requirement: Dynamic sidebar and shell from session data

The sidebar/header MUST derive from the session, `tenant.modules`, and role (today hardcoded team/tabs). The header MUST reflect the real tenant name; a customers tab MUST appear; module entries MUST hide for inactive modules and roles.

#### Scenario: Role-filtered navigation

- GIVEN a STAFF session on a distribution tenant
- WHEN the shell renders
- THEN distribution tabs (incl. customers) show and admin/settings entries do NOT
- AND a TENANT_ADMIN sees the admin entry

#### Scenario: Module-driven visibility

- GIVEN a tenant whose `modules` exclude gym
- WHEN the shell renders
- THEN gym navigation is absent (no hardcoded tabs)

#### Scenario: Missing i18n key

- GIVEN a locale lacking a shell key
- WHEN the shell renders
- THEN it falls back without crashing