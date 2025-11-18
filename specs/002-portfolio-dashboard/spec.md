# Feature Specification: Portfolio Dashboard

**Feature Branch**: `002-portfolio-dashboard`  
**Created**: November 17, 2025  
**Status**: Draft  
**Input**: User description: "Portfolio dashboard with portfolio-wide metrics, account grid with performance details, and bulk actions for managing multiple accounts"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Portfolio Performance Overview (Priority: P1)

As a portfolio manager, I need to see an at-a-glance summary of my total portfolio value, daily performance, and historical trends so I can quickly assess my overall portfolio health.

**Why this priority**: This is the primary use case for the dashboard and delivers immediate value by providing the highest-level information the user needs without requiring any additional actions. It establishes the foundation of the dashboard.

**Independent Test**: Can be fully tested by loading the dashboard and verifying the portfolio summary metrics are displayed and updated correctly. Delivers the core value of financial visibility.

**Acceptance Scenarios**:

1. **Given** a user with multiple accounts, **When** they navigate to the dashboard, **Then** they see the total portfolio value across all accounts displayed prominently
2. **Given** market activity during the trading day, **When** the dashboard loads, **Then** the percent gain/loss for the current day is displayed with appropriate sign (+ for gains, - for losses)
3. **Given** the user is viewing the dashboard, **When** they interact with the chart timeframe controls, **Then** they can select from predefined periods: Last 30 Days, Last 60 Days, Last 90 Days, Last 180 Days, and TTM (Trailing Twelve Months)
4. **Given** the user selects a new timeframe, **When** the selection is confirmed, **Then** the chart updates to display the portfolio value history for that period with all historical data points visible
5. **Given** a user with no trading activity in the selected period, **When** the chart is displayed, **Then** a flat or minimal-change visualization is shown with clear indication of the period

---

### User Story 2 - Review Individual Account Performance (Priority: P1)

As a portfolio manager, I need to see the performance and current status of each account in a table format so I can quickly identify which accounts need attention or action.

**Why this priority**: This is critical for portfolio management as it enables users to monitor individual accounts and make informed decisions about which accounts to act on. It's independently valuable and required for the bulk actions that follow.

**Independent Test**: Can be fully tested by verifying the account grid displays all required columns with accurate data, and users can view account details without needing to perform any bulk actions.

**Acceptance Scenarios**:

1. **Given** a user with multiple accounts, **When** the dashboard loads, **Then** an account grid is displayed with one row per account
2. **Given** the account grid is displayed, **When** the user views a row, **Then** the following columns are visible for each account:
   - Account Name
   - Current Value
   - Today's Gain/Loss (absolute and/or percentage)
   - Excess Cash
   - Correctable Drift
   - Total Drift
3. **Given** an account with positive gain/loss, **When** the dashboard displays the value, **Then** the gain/loss is shown with a positive indicator (+ sign or green coloring)
4. **Given** an account with negative gain/loss, **When** the dashboard displays the value, **Then** the gain/loss is shown with a negative indicator (- sign or red coloring)
5. **Given** the user is reviewing account details, **When** they see drift values, **Then** both the absolute drift value and any relevant context (e.g., percentage deviation) are visible

---

### User Story 3 - Perform Bulk Account Actions with Safety Warnings (Priority: P2)

As a portfolio manager, I need to select multiple accounts and perform bulk actions (Liquidate, Rebalance, Use Cash) with appropriate warnings so I can efficiently manage my portfolio while protecting against accidental execution of critical operations.

**Why this priority**: This enables efficient portfolio management through bulk operations, but with safety measures. It's dependent on having visibility of accounts (User Story 2), so it ranks as P2.

**Independent Test**: Can be fully tested by selecting accounts, initiating bulk actions, and verifying warning dialogs appear and actions execute correctly. Each action can be tested independently.

**Acceptance Scenarios**:

1. **Given** the account grid is displayed, **When** the user views a row, **Then** a checkbox appears at the beginning of each row for row selection
2. **Given** one or more accounts are selected via checkboxes, **When** the user looks at the action menu/area, **Then** three action buttons become available: Liquidate, Rebalance, and Use Cash
3. **Given** one or more accounts are selected and during normal market hours, **When** the user clicks "Liquidate", **Then** a first warning dialog appears confirming intent with details about selected accounts
4. **Given** the user confirms the first liquidate warning, **When** the action continues, **Then** a second warning dialog appears with final confirmation and details about the impact
5. **Given** the user confirms both liquidate warnings, **When** the action executes, **Then** market orders are submitted to sell all positions in selected accounts
6. **Given** one or more accounts are selected and outside normal market hours, **When** the user clicks "Liquidate", **Then** the warning dialogs appear AND an additional dialog is displayed warning that the order will execute immediately with potential negative results due to thin order books
7. **Given** one or more accounts are selected, **When** the user clicks "Rebalance", **Then** a single warning dialog appears asking for confirmation to rebalance the selected accounts
8. **Given** the user confirms the rebalance warning, **When** the action executes, **Then** positions in selected accounts are adjusted to match the target model weights
9. **Given** one or more accounts are selected, **When** the user clicks "Use Cash", **Then** no warning dialog appears (proceed to execution or show progress)
10. **Given** the user initiates "Use Cash" action, **When** the action executes, **Then** available cash in selected accounts is deployed to purchase securities that bring the portfolio closest to the target model allocation weights

---

### Edge Cases

- **No accounts**: What happens when a user has no accounts configured? Dashboard should display an empty state with a call-to-action to add accounts.
- **No drift**: What happens when an account has zero correctable drift? Display the value as "0" or similar, no special treatment needed.
- **Market closed**: How does the system determine if markets are open? Use market hours for the primary exchange (assumed to be US markets based on Schwab integration) and ensure UI clearly indicates market status to the user.
- **No positions**: What happens when an account has no positions? Display "Use Cash" as an option and communicate that rebalancing or liquidation is not applicable.
- **Partial selection**: What happens if the user selects only some accounts? Actions should only apply to selected accounts; unselected accounts are not affected.
- **Action in progress**: What happens if a user clicks an action button while another action is still executing? Disable action buttons during execution and show progress indicator.
- **Network failure during execution**: If an action fails mid-execution, display an error message and allow the user to retry or cancel.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Dashboard MUST display the total portfolio value across all accounts as a primary metric on page load
- **FR-002**: Dashboard MUST display the current day's gain/loss percentage and amount alongside the total portfolio value
- **FR-003**: Dashboard MUST display an interactive chart showing portfolio value history for the last 30 days on initial page load
- **FR-004**: Dashboard MUST provide controls to change the chart timeframe to: 30 days, 60 days, 90 days, 180 days, and TTM (trailing twelve months)
- **FR-005**: Dashboard MUST display an account grid with one row per account
- **FR-006**: Each account row MUST display: Account Name, Current Value, Today's Gain/Loss, Excess Cash, Correctable Drift, and Total Drift
- **FR-007**: Account values and drift figures MUST be displayed with appropriate numerical formatting (currency for values, percentage for gains/losses as applicable)
- **FR-008**: Each account row MUST include a checkbox for row selection
- **FR-009**: When zero or one account is selected, action buttons (Liquidate, Rebalance, Use Cash) MUST be hidden or disabled
- **FR-010**: When one or more accounts are selected, action buttons MUST become enabled and visible
- **FR-011**: Liquidate action MUST display a first warning dialog describing the intent and the accounts affected
- **FR-012**: After confirmation of the first liquidate warning, Liquidate MUST display a second warning dialog with final confirmation
- **FR-013**: System MUST detect current market hours; if liquidate is requested outside normal market hours, a third warning dialog MUST be displayed explaining that the order will execute immediately and may result in poor pricing due to thin order books
- **FR-014**: Rebalance action MUST display a single warning dialog asking for confirmation before proceeding
- **FR-015**: Use Cash action MUST allow execution to proceed after account selection without requiring additional confirmation dialogs
- **FR-016**: Liquidate action MUST submit market orders to sell all positions at market for each selected account
- **FR-017**: Rebalance action MUST adjust positions in selected accounts to match the target model allocation weights
- **FR-018**: Use Cash action MUST deploy available cash in selected accounts to purchase securities that bring the portfolio allocation closest to the target model weights
- **FR-019**: Dashboard MUST update displayed values in real-time or at a reasonable refresh interval (e.g., every 5-30 seconds) to reflect current market data
- **FR-020**: Dashboard MUST handle accounts with zero positions gracefully; Rebalance and Liquidate should have appropriate availability messaging

### Key Entities *(include if feature involves data)*

- **Portfolio**: Aggregate of all user accounts with combined metrics (total value, daily gain/loss, performance chart data)
- **Account**: Individual brokerage account with properties (name, current value, daily gain/loss, excess cash, correctable drift, total drift, positions, cash balance)
- **Position**: Individual security holding within an account with properties (ticker, quantity, current price, market value, allocation percentage)
- **Model Allocation**: Target allocation weights for the portfolio defining the ideal distribution across securities or asset classes
- **Drift**: Measure of deviation from model allocation; "Correctable Drift" represents drift that can be fixed with current cash, "Total Drift" represents all deviation

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view their total portfolio performance and account-level details in under 3 seconds after dashboard loads
- **SC-002**: Chart visualization displays correctly and updates smoothly when timeframe is changed (within 1 second)
- **SC-003**: Users can select multiple accounts and perform bulk actions with clear visual feedback and protection via warning dialogs
- **SC-004**: 100% of liquidate and rebalance operations proceed through appropriate warning dialogs before execution
- **SC-005**: Market hours detection functions correctly such that out-of-hours liquidate requests trigger the additional thin order book warning
- **SC-006**: Dashboard remains responsive with up to 50 accounts displayed in the grid without performance degradation
- **SC-007**: Dashboard layout is responsive and usable on desktop (1920x1080) and tablet (768x1024) viewports
- **SC-008**: 90% of users successfully locate and understand the account grid columns and their meanings without requiring help
- **SC-009**: All bulk actions (Liquidate, Rebalance, Use Cash) complete execution within 30 seconds from user confirmation

## Assumptions

- **Market data availability**: Portfolio Dashboard will use existing market data APIs (e.g., Schwab API) for pricing and account data
- **Authentication**: Users are already authenticated before accessing the dashboard
- **Market hours**: Standard US equity market hours are assumed (9:30 AM - 4:00 PM ET); market hours detection will use exchange data
- **Default model allocation**: A model allocation exists for each account and is already defined in the system
- **Bulk operation implementation**: Liquidate, Rebalance, and Use Cash operations have existing backend service implementations
- **User permissions**: All authenticated users have permission to view their own portfolio and perform bulk actions on their own accounts
