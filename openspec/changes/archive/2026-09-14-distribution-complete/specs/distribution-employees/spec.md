# Distribution Employees Specification

## Purpose

Employee update, deactivate, and User link with POS PIN; hireDate, salary, and commission validated (GET/POST only today).

## Requirements

### Requirement: Employee update, deactivate, and POS User link

Employees MUST support update and deactivate (GET/POST only today) and MUST be linkable to a `User` with a POS PIN so staff can authenticate by PIN. `hireDate`, salary, and commission MUST be validated (invalid `hireDate` today yields 500).

#### Scenario: Update employee and link PIN user

- GIVEN an existing employee
- WHEN an update sets salary/commission and links a User with POS PIN
- THEN changes persist and the linked User can log in with the PIN

#### Scenario: Deactivate employee

- GIVEN an active employee
- WHEN the employee is deactivated
- THEN the employee is marked inactive and no longer selectable for operations

#### Scenario: Invalid dates/values

- GIVEN an update with an invalid `hireDate` or negative salary/commission
- WHEN submitted
- THEN the server responds 400 (no 500) and nothing changes