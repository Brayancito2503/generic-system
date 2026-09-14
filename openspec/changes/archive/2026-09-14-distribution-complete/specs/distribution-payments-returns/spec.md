# Distribution Payments and Returns Specification

## Purpose

Payment methods, credit sales with receivables, and audited returns/voids that restore stock; all money math server-side.

## Requirements

### Requirement: Payment methods, credit sales, receivables, and returns

Sales MUST record payment method, paid amount, and balance (credit sales create a receivable). Returns/voids MUST restore stock and be audited. All money math MUST be server-side.

#### Scenario: Cash sale with tender

- GIVEN a cart and a cash payment
- WHEN the sale is registered
- THEN paid/change are computed server-side and the receivable is zero

#### Scenario: Credit sale

- GIVEN a cart paid partially or not at all
- WHEN the sale is registered
- THEN a balance/ receivable is persisted and tracked

#### Scenario: Return restores stock

- GIVEN a completed sale with items
- WHEN a return/void is processed for a sold quantity
- THEN stock is restored and the return is recorded against the sale

#### Scenario: Return over quantity

- GIVEN a sale with N units of an item
- WHEN a return exceeds N
- THEN the server rejects with 409 and stock is unchanged