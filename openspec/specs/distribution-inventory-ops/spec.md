# Distribution Inventory Specification

## Purpose

Inventory delete, multi-branch stock updates, and negative-value guards on cost, price, and stock.

## Requirements

### Requirement: Inventory delete, multi-branch updates, and value guards

Inventory MUST support deletion, `updateInventoryItem` MUST update only the targeted branch (today it touches only `inventory[0]`), and cost/price/stock MUST reject negative values.

#### Scenario: Multi-branch stock update

- GIVEN an item with stock in branches A and B
- WHEN stock is updated for branch B
- THEN only branch B changes; branch A is untouched

#### Scenario: Delete item

- GIVEN an item with no persisted transaction references
- WHEN delete is requested
- THEN the item is removed
- AND delete of an item referenced by sales/POs returns 409

#### Scenario: Negative values rejected

- GIVEN an item create/update with negative cost, price, or stock
- WHEN submitted
- THEN the server responds 400 and no change persists