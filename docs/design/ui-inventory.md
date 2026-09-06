# Biyong — Comprehensive Mobile UI Specification & Screen Inventory

> **Document Purpose:** Complete architectural and visual inventory of every screen, modal, sub-view, component, and interaction in the Biyong mobile application. Designed as the primary handoff reference for product designers to create refined visual design mockups, design systems (Figma), and UX improvements.

---

## 1. Design System & Foundational Principles

### 1.1 Core Aesthetic Guidelines
1. **Minimalist Fintech Aesthetic:** High data density without clutter, elegant typography hierarchy, generous touch targets (minimum 44x44 dp), and subdued borders.
2. **Zero Floating-Point Jargon:** Every monetary figure is formatted with proper currency formatting (e.g. `₹12,450.00`). Users must never see developer terminology like "minor units", "paise", "cents", or "derived balance".
3. **Strictly No Raw Emojis:** The application relies exclusively on an icon pack (`@expo/vector-icons`: `Ionicons` & `Feather`). Emojis are prohibited across all UI elements, buttons, and badges.
4. **Safe Area Inset Protection:** All views strictly observe `useSafeAreaInsets()`. Screen content never collides with or bleeds underneath the status bar, camera notch, Dynamic Island, or Android gesture navigation pill.
5. **Clean Zero-Data Start:** Fresh installs boot with zero dummy data and present an onboarding flow to guide first-time account setup.
6. **Isolated Technical Diagnostics:** System stats, SQLite engine logs, and database metrics are strictly quarantined to the bottom of the Settings screen.

### 1.2 Color Themes & Accent Presets
The app supports 3 Theme Modes and 6 Brand Accent Presets powered by centralized design tokens (`ThemeContext.tsx`):
- **Modes:** `Light`, `Dark`, `System`
- **Backgrounds:**
  - Dark: Deep Charcoal (`#09090b` / `#121215`), Surface Card (`#18181b` / `#1e1e24`), Card Elevated (`#27272a`)
  - Light: Pure Crisp White (`#ffffff`), Surface Canvas (`#f4f4f5` / `#f8fafc`), Card Elevated (`#ffffff`)
- **Accent Presets:**
  1. `default` — Emerald Green (`#10b981`)
  2. `ocean` — Sapphire Cyan (`#0ea5e9`)
  3. `forest` — Sage Forest (`#059669`)
  4. `violet` — Electric Indigo (`#8b5cf6`)
  5. `amber` — Warm Golden Amber (`#f59e0b`)
  6. `rose` — Crimson Rose (`#f43f5e`)
- **Semantic Financial Colors:**
  - Income / Surplus / Healthy: Emerald (`#10b981`)
  - Expense / Debt / Exceeded: Crimson Red (`#ef4444`)
  - Warning / Approaching Limit: Amber (`#f59e0b`)
  - Transfers / Informational: Accent Violet or Slate Blue (`#6366f1`)

---

## 2. Navigation Architecture

### Bottom Tab Navigator (Persistent Root Bar)
The application utilizes a persistent, inset-safe bottom navigation bar with responsive active highlight states:

| Tab ID | Label | Inactive Icon | Active Icon | Primary Screen Component |
| :--- | :--- | :--- | :--- | :--- |
| `home` | **Home** | `home-outline` | `home` | `HomeScreen` |
| `accounts` | **Accounts** | `wallet-outline` | `wallet` | `AccountsScreen` |
| `transactions` | **Ledger** | `swap-horizontal-outline` | `swap-horizontal` | `TransactionsScreen` |
| `budgets` | **Budgets** | `pie-chart-outline` | `pie-chart` | `BudgetsGoalsScreen` |
| `groups` | **Groups** | `people-outline` | `people` | `GroupsScreen` |
| `reports` | **Reports** | `bar-chart-outline` | `bar-chart` | `ReportsScreen` |
| `settings` | **Settings** | `settings-outline` | `settings` | `SettingsScreen` |

---

## 3. Screen-by-Screen Visual Inventory

### Screen 1: First-Time Onboarding Flow (`OnboardingModal.tsx`)
- **Trigger:** App launch when `app_preferences.hasCompletedOnboarding === false`.
- **Layout:** Fullscreen modal with smooth slide/card transitions.
- **Sub-Steps:**
  1. **Welcome Slide:**
     - App icon / emblem with accent glow.
     - Headline: *"Welcome to Biyong"*
     - Subtitle: *"Private, honest, 100% offline personal finance."*
     - Value proposition cards: Zero ads, zero bank scraping, full data sovereignty.
  2. **The Ledger Philosophy Slide:**
     - Visual diagram showing money movement (Income → Accounts → Expenses).
     - Core financial invariant note: *"Transfers between your own accounts never count as expenses."*
  3. **First Account Setup Slide:**
     - Input field: Account Name (e.g. "Primary Bank", "Cash Wallet").
     - Account Type Selector: Grid of types (Bank, Cash, Wallet, Credit).
     - Starting Balance Input: Currency-formatted input.
     - CTA Button: *"Get Started"* → creates account, persists onboarding completion, transitions to Home.

---

### Screen 2: Home / Financial Dashboard (`HomeScreen.tsx`)
- **Header:**
  - Greeting ("Good morning / afternoon / evening"), current date.
  - Active profile / avatar badge.
- **Hero Card: Net Worth Overview:**
  - Total Net Worth banner (large prominent font, e.g. `₹1,45,200.00`).
  - Monthly Cashflow Mini-Stats: Total Income (green with arrow down-left) and Total Expenses (red with arrow up-right).
- **Quick Action Bar:**
  - 3 primary pill buttons:
    - `+ Expense` (accent color icon, opens `QuickAddModal` with Expense preselected).
    - `+ Income` (green icon, opens `QuickAddModal` with Income preselected).
    - `Transfer` (blue icon, opens `QuickAddModal` with Transfer preselected).
- **Accounts Carousel / Preview:**
  - Section title with *"See all"* link pointing to Accounts tab.
  - Horizontal card list displaying account name, type icon, and live balance.
- **Recent Transactions Section:**
  - Section title with *"View all"* link pointing to Ledger tab.
  - Last 5 transactions with category icons, merchant name/notes, relative timestamp, and color-coded signed amounts.
- **Empty State (Fresh install):**
  - Sleek illustration/icon card encouraging first transaction or account creation.

---

### Screen 3: Accounts Hub (`AccountsScreen.tsx`)
- **Header:**
  - Title: *"Your Accounts"*.
  - Total Net Worth & Assets vs. Liabilities summary pill.
- **Action Bar:**
  - `+ Add Account` button triggering `AddAccountModal`.
- **Account Groups / Cards List:**
  - Grouped or tagged by category:
    - **Liquid Accounts:** Checking, Savings, Cash Wallets.
    - **Credit & Liabilities:** Credit Cards, Loans.
    - **Investments:** Mutual Funds, Stocks, Deposits.
  - **Account Card Elements:**
    - Icon reflecting account type (Bank building, Wallet, Card).
    - Account Name & Type badge (e.g. `Bank`, `Cash`, `Credit`).
    - Derived balance (large bold font).
    - Action menu / swipe actions: *View Transactions*, *Archive Account*.
- **Archived Accounts Accordion:**
  - Collapsible drawer showing inactive/closed accounts without cluttering active net worth.

---

### Screen 4: Transactions Ledger & Search (`TransactionsScreen.tsx`)
- **Header:**
  - Title: *"Transaction History"*.
  - Total transactions count.
- **Search & Filter Bar:**
  - Instant text search field: searches merchant names, descriptions, and notes in real time.
  - Horizontal Filter Chips:
    - Type filters: `All`, `Expenses`, `Income`, `Transfers`.
    - Category filter dropdown / horizontal scroll (e.g. `Groceries`, `Dining`, `Housing`, `Utilities`).
    - Date range selector.
- **Transaction Feed:**
  - Date-grouped sections (e.g. *"Today"*, *"Yesterday"*, *"September 4, 2026"*).
  - **Transaction Row Item (`TransactionItem.tsx`):**
    - Left: Category circular icon badge with category-tinted background.
    - Center: Merchant or title (primary bold), Account name & subcategory (secondary small).
    - Right: Amount formatted with `+` or `-` and color-coded (Green for income, Red for expense, Blue for transfer).
    - Recurring indicator badge (small repeat icon if transaction is scheduled).
  - Tap interaction: Opens detail modal with options to edit or delete with confirmation.

---

### Screen 5: Budgets & Goals Hub (`BudgetsGoalsScreen.tsx`)
- **Header Segmented Pill Switch:**
  - Toggle between `[ Budgets ]` and `[ Goals ]`.
- **Sub-View A: Category Budgets:**
  - **Summary Banner:**
    - Total Budgeted, Total Spent, Remaining Balance across all budgets.
    - Overall Adherence Bar (color-shifting based on aggregate consumption).
  - **Category Budget Cards:**
    - Category Icon & Name.
    - Period Badge: `Monthly` or `Weekly`.
    - Health Status Badge:
      - `Healthy` (Emerald pill, <80% consumed).
      - `Warning` (Amber pill, 80%–99% consumed).
      - `Exceeded` (Red pill, ≥100% consumed).
    - Multi-color progress bar indicating spend percentage.
    - Budget Details: `₹6,500.00 spent of ₹10,000.00`.
    - Daily Allowance Metric: `₹145.83 / day remaining (24 days left)`.
    - Rollover Indicator Badge: `Rollover On: Surplus carries over`.
    - Delete Budget button.
  - Floating Action Button: `+ Set Budget` (opens `AddBudgetModal`).
- **Sub-View B: Savings Goals:**
  - **Summary Banner:**
    - Total Saved across all goals vs. Combined Target.
  - **Savings Goal Cards:**
    - Goal Title & Target Date Badge (e.g. *"Target: Feb 2027"*).
    - Progress Bar with percentage completed (e.g. `42%`).
    - Amount details: `₹50,000.00 saved of ₹1,20,000.00`.
    - Required Savings Calculator: *"Save ₹11,666.67 / month to hit target on time"*.
    - Projected Completion Pill: *"On track for Feb 06, 2027"*.
    - Primary Button: `+ Contribute` (opens `ContributeGoalModal`).
    - Delete goal action.
  - Floating Action Button: `+ New Goal` (opens `AddGoalModal`).

---

### Screen 6: Groups, Splits & Settlements (`GroupsScreen.tsx`)
- **State A: Groups Directory (When no active group is selected):**
  - Header: Title *"Groups & Splits"* with offline guarantee badge.
  - Educational Card: *"Transparent group expense splitting with zero-sum mathematical settlement."*
  - Groups Card List:
    - Group Name (e.g. *"Goa Trip"*, *"Flat 402 Bills"*).
    - Member Avatars / Initials count.
    - Total group expenditure formatted.
    - Tap card → sets active group and navigates into Group Detail view.
    - Delete group action with safety confirmation.
  - Primary CTA: `+ Create Group` (opens `AddGroupModal`).
- **State B: Active Group Detail View:**
  - **Sticky Top Bar:**
    - Back button (`< All Groups`), Group Title, Currency indicator (`INR`).
    - Group Total Spend summary badge.
  - **Sub-Tab Switcher:**
    - `[ Expenses ]` | `[ Balances & Settle ]` | `[ Graph ]`
  - **Tab 1: Group Expenses:**
    - Chronological list of group expenses.
    - Each item shows: Expense Title, Date, Paid By member name, Split Method badge (`Equal`, `Exact`, `Percentage`, `Shares`, `Itemized`), Total Amount.
    - Delete expense button.
    - Floating CTA: `+ Add Expense` (opens `AddGroupExpenseModal`).
  - **Tab 2: Balances & Settlement Plan:**
    - **Member Balances Section:**
      - Cards for each participant with net standing:
        - `Gets Back ₹31,075.00` (Emerald badge for creditors).
        - `Owes ₹8,125.00` (Red badge for debtors).
        - `Settled Up ₹0.00` (Subdued gray badge).
      - Tap any member card → opens `ExplanationModal` with complete audit trail.
    - **Simplified Debt Settlements (Min-Cash-Flow):**
      - Explanatory header: *"Debts simplified into minimum transactions."*
      - Settlement Transfer Cards (e.g. *"Bob pays Alice: ₹8,125.00"*).
      - Primary Action Button: `Settle Up` → opens `SettleModal` prefilled with debtor, creditor, and amount.
      - If all balances are zero: Full-width celebration banner *"All settled up! Group is even."*
  - **Tab 3: Dependency Graph:**
    - Visual financial network representation showing nodes (Members and Expenses) and directed edges (Payer contributions and participant liability shares).
    - Mathematical transparency breakdown confirming zero-sum conservation.

---

### Screen 7: Reports & Advanced Financial Analytics (`ReportsScreen.tsx`)
- **Date / Period Navigator:**
  - Month & Year picker with `< Previous` and `Next >` navigation buttons.
- **Monthly Cashflow Card:**
  - Income, Expenses, Net Savings, and Savings Rate % pill badge.
- **Fixed vs. Variable Spending Breakdown Card:**
  - Two-column stats: Fixed Spending (Bills/Rent/Utilities) vs. Variable Spending (Dining/Shopping/Groceries).
  - Two-color segmented horizontal bar visualizing the percentage split.
  - Explanatory footnote helping non-financial users optimize savings.
- **Multi-Month Spending & Savings Trends:**
  - Historical 6-month table / bar cards displaying Income vs. Expenses and resulting Savings Rate badge for each period.
- **Category Spending Breakdown:**
  - Ranked category progress bars with monetary amount and percentage of total expenditure.
- **Top Merchants Leaderboard:**
  - Ranked list of top spending destinations.

---

### Screen 8: Settings & Customization (`SettingsScreen.tsx`)
- **Appearance & Themes:**
  - Mode Switcher: `Light`, `Dark`, `System` pill buttons.
  - Accent Color Palette: 6 circular color swatches (`Default Emerald`, `Ocean Blue`, `Forest Sage`, `Violet Indigo`, `Amber Warm`, `Rose Pink`) with live selection ring.
- **Data & Ledger Preferences:**
  - `Reset Onboarding`: Re-launch initial welcome guide.
  - `Load Demo Data`: Seeds comprehensive sample accounts, transactions, budgets, goals, and trip groups.
  - `Wipe Local Database`: Clears all local SQLite records with dual-step confirmation.
- **Technical & Offline Diagnostics (Power-User Section at Bottom):**
  - SQLite Engine version, local database schema migration status, accounts count, transactions count, categories count.

---

## 4. Complete Modals & Dialogs Inventory

| Modal Name | File Path | Trigger / Purpose | Key Inputs & UI Elements |
| :--- | :--- | :--- | :--- |
| **Quick Add Modal** | `src/components/QuickAddModal.tsx` | Global `+` button or Home action buttons | Segmented Type toggle (`Expense`, `Income`, `Transfer`), numeric keypad amount input, category picker, source account, destination account (for transfers), notes, merchant, recurring toggle. |
| **Add Account Modal** | `src/components/AddAccountModal.tsx` | `+ Add Account` button in Accounts tab | Account Name, Account Type selector (Bank, Cash, Wallet, Credit, Investment), Initial Balance, Currency selector. |
| **Add Budget Modal** | `src/components/AddBudgetModal.tsx` | `+ Set Budget` button in Budgets tab | Category picker (filtered to expense categories), Budget Amount in currency, Period selector (`Monthly` vs `Weekly`), Rollover toggle switch. |
| **Add Goal Modal** | `src/components/AddGoalModal.tsx` | `+ New Goal` button in Goals tab | Goal Title, Target Amount, Initial Saved Balance, Target Date input with quick preset chips (`3 Months`, `6 Months`, `1 Year`, `2 Years`). |
| **Contribute Goal Modal** | `src/components/ContributeGoalModal.tsx` | `Contribute` button on any Goal Card | Goal summary progress bar, Amount to contribute input, quick percentage chips (`+10%`, `+25%`, `+50%`). |
| **Add Group Modal** | `src/components/AddGroupModal.tsx` | `+ Create Group` button in Groups tab | Group Name input, Currency picker, Member Name input with `+ Add Person` chip builder, Remove chip actions. |
| **Add Group Expense Modal** | `src/components/AddGroupExpenseModal.tsx` | `+ Add Expense` button in Group view | Expense Title, Amount, Date, Paid By selector (Single member or Multiple Payers split), Split Method selector (`Equal`, `Exact`, `Percentage`, `Shares`, `Itemized`), dynamic member allocation inputs. |
| **Settle Modal** | `src/components/SettleModal.tsx` | `Settle Up` button on simplified debt card | Payer member dropdown, Receiver member dropdown, Amount input (pre-populated), Notes, `Confirm Settlement` button. |
| **Settlement Explanation Modal** | `src/components/ExplanationModal.tsx` | Tapping any member card in Balances tab | Full mathematical audit trail: Total paid vs total share, settlements made/received, net balance, itemized list of all contributing expenses with net contribution (+/-). |
| **Onboarding Modal** | `src/components/OnboardingModal.tsx` | Fresh app launch | 3-step carousel with value props, privacy guarantees, and initial account setup form. |

---

## 5. UI Improvements & Figma Recommendations for Designers

1. **Card Hierarchy & Elevation:**
   - Implement subtle 1px border highlights (`rgba(255, 255, 255, 0.08)` in dark mode, `rgba(0, 0, 0, 0.06)` in light mode) with soft backdrop blur on cards.
2. **Numeric Typography:**
   - Utilize tabular numbers (`fontVariant: ['tabular-nums']`) for all currency amounts to ensure perfect vertical decimal alignment across ledgers and reports.
3. **Micro-Interactions:**
   - Haptic feedback (`expo-haptics`) upon transaction entry, quick action taps, and settlement confirmations.
   - Smooth progress bar filling animations for budgets and savings goals.
4. **Group Expense Split Ergonomics:**
   - For `AddGroupExpenseModal`, design a streamlined quick keypad with instant sum-validation indicators (e.g. green checkmark when exact/percentage splits match total amount).
5. **Graph Visualizations:**
   - Design interactive SVG or Canvas node-link diagrams for the Group Dependency Graph with draggable participant bubbles.
