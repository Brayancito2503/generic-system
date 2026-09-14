# Distribution Dashboard Specification

## Purpose

Real dashboard trend badges computed from sales queries and topProducts revenue from sale-time prices; no hardcoded demo values.

## Requirements

### Requirement: Real dashboard trends and top products

Trend badges MUST be computed from real sales queries (no `+12.4%`-style hardcodes); `topProducts` revenue MUST use actual sale prices (SaleItem), not current item prices.

#### Scenario: Real trend computation

- GIVEN sales data spanning two periods
- WHEN the dashboard loads
- THEN trend percentages derive from the queried data

#### Scenario: Top products actual revenue

- GIVEN products sold at historical prices
- WHEN rankings render
- THEN revenue reflects sale-time prices

#### Scenario: Empty period

- GIVEN a period with zero sales
- WHEN the dashboard computes trends
- THEN it renders 0%/empty state without division errors