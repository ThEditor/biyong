# Biyong — Comprehensive Mobile UI Specification & Screen Inventory

> **Document Purpose:** Authoritative architectural and visual inventory of every screen, modal, sub-view, component, and interaction in the Biyong mobile application. This document bridges the **modern purple fintech visual design inspiration** (from the design mockups) with the **full production feature set and business logic** implemented across Phases 0, 1, 2, 3, and 4.
>
> **Design Note:** The uploaded design mockups serve strictly as *visual and aesthetic inspiration* (color palette, typography hierarchy, card elevation, circular progress rings, donut charts, and floating tab bar layout). The *functionality, data models, and feature set* documented herein represent the complete, verified Biyong architecture.

---

## 1. Design System & Foundational Principles

### 1.1 Core Aesthetic Guidelines

1. **Modern Purple Fintech Aesthetic:** High data density wrapped in a clean, soft-card interface using electric violet gradients (`#7C3AED` to `#9333EA` / `#8B5CF6`), crisp white/dark cards, generous touch targets (minimum 44×44 dp), and soft ambient drop shadows (`shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10`).
2. **100% Offline-First Architecture:** The UI never blocks on network connectivity. All financial queries, ledger calculations, budgets, goals, and group expense splits run against the local SQLite database.
3. **Multi-Currency Precision & Zero Floating-Point Jargon:** Every monetary figure is formatted through `formatMoney()` with locale-specific symbols (`₹ 87,457.85`, `$ 3,257.00`, `€ 1,250.00`). Users never see developer jargon like "minor units", "paise", or "cents". Tabular numbers (`fontVariant: ['tabular-nums']`) are enforced for vertical decimal alignment.
4. **Strictly Vector Icons Only:** The application exclusively uses `@expo/vector-icons` (`Ionicons` and `Feather`). Emojis are strictly prohibited across all screens, buttons, pills, and status badges.
5. **Safe Area Inset Protection:** All views strictly observe `useSafeAreaInsets()`. Screen content never collides with or bleeds underneath the status bar, camera notch, Dynamic Island, or Android gesture navigation pill.
6. **Clean Zero-Data Start with Onboarding:** Fresh installs boot with zero dummy data and present an onboarding welcome flow (featuring 3D visual graphics and account initialization).
7. **Isolated Technical Diagnostics:** System stats, SQLite engine logs, sync outbox queues, and schema versions are strictly quarantined in a collapsible section at the bottom of the Settings screen.

### 1.2 Color Themes & Accent Presets

The app supports 3 Theme Modes powered by centralized design tokens (`ThemeContext.tsx`):

* **Theme Modes:** `Light`, `Dark`, `System`
* **Primary Gradient Tokens (Inspiration Mockup Matching):**
  * Hero Balance Banner: Electric Violet to Soft Magenta (`#7C3AED` → `#A855F7` / `#C084FC`)
  * Accent Floating Action Button (FAB): Electric Violet (`#8B5CF6`)
* **Surfaces & Canvases:**
  * Light Canvas: Soft Cool Gray (`#F8FAFC` / `#F1F5F9`), Surface Card (`#FFFFFF`), Border (`#E2E8F0`)
  * Dark Canvas: Charcoal / Deep Navy (`#0F172A` / `#1E293B`), Surface Card (`#1E293B`), Border (`#334155`)
* **Semantic Financial Status Colors:**
  * Income / Surplus / Healthy (<80% spend): Emerald Green (`#10B981`)
  * Expense / Debt / Exceeded (≥100% spend): Crimson Red / Coral (`#EF4444` / `#F97316`)
  * Warning / Approaching Limit (80%–99% spend): Warm Amber (`#F59E0B`)
  * Transfers / Neutral / Sync: Slate Blue & Cyan (`#6366F1` / `#0EA5E9`)

---

## 2. Navigation Architecture & Full Feature Accessibility

### 2.1 Persistent Bottom Navigation Bar

The primary root navigation adopts a **4-Tab Bar with an Elevated Central Floating Action Button (FAB)** matching the design mockups:

| Tab ID | Label | Inactive Icon | Active Icon | Primary Screen Component | Description & Sub-Views |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `home` | **Home** | `home-outline` | `home` | `HomeScreen` | Total Balance Banner, Cashflow Summary, Safe-to-Spend Ring, Recent Transactions |
| `reports` | **Report** | `bar-chart-outline` | `bar-chart` | `ReportsScreen` | Donut & Bar Charts, Category Breakdown, Fixed vs Variable, Spending Trends |
| `fab` | *(Center)* | `add` | `add` | *Global Quick Add* | Elevated circular violet FAB (`+`) triggering `QuickAddModal` |
| `plan` | **Plan** | `wallet-outline` | `wallet` | `BudgetsGoalsScreen` / `PlanScreen` | Segmented Switcher: Category Budgets (progress rings) & Savings Goals |
| `settings` | **Settings** | `settings-outline` | `settings` | `SettingsScreen` | Account & Cloud Sync, Appearance, Currency, Backup, Diagnostics |

### 2.2 Complete Feature Accessibility Mapping (Phases 0–4)

To guarantee that **100% of all features implemented across Phases 0–4 remain easily accessible**, the application provides seamless contextual gateways from the Home Dashboard, App Headers, and Transaction details:

| Feature Area | Phase | Dedicated Screen / Modal | Primary User Access Gateway(s) |
| :--- | :--- | :--- | :--- |
| **Accounts Management** | Phase 1 | `AccountsScreen.tsx` | 1. Tap "Current Balance" Hero Card on Home.<br>2. `💳 Accounts` pill button in Home Quick Actions.<br>3. "Your Accounts" row on Home. |
| **Transactions Ledger** | Phase 1 | `TransactionsScreen.tsx` | 1. Tap `See All` on "Transactions" section on Home.<br>2. Search bar or filter button on Home activity feed. |
| **Transaction Details & Actions** | Phase 1 | `TransactionDetailSheet.tsx` | Tap any transaction row in Home feed or Transactions Ledger. |
| **Category Budgets** | Phase 2 | `BudgetsGoalsScreen.tsx` (`Budgets` tab) | `Plan` tab in bottom navigation → `[ Budgets ]` pill toggle. |
| **Savings Goals** | Phase 2 | `BudgetsGoalsScreen.tsx` (`Goals` tab) | `Plan` tab in bottom navigation → `[ Goals ]` pill toggle. |
| **Fixed vs Variable Spending** | Phase 2 | `ReportsScreen.tsx` | `Report` tab in bottom navigation → Scroll to "Fixed vs Variable" card. |
| **6-Month Spending Trends** | Phase 2 | `ReportsScreen.tsx` | `Report` tab in bottom navigation → Scroll to "Spending Trends" section. |
| **Private Groups Directory** | Phase 3 | `GroupsScreen.tsx` (All Groups) | 1. `👥 Split / Groups` pill button in Home Quick Actions.<br>2. `Split Money` button inside `TransactionDetailSheet`. |
| **Group Expense Split (4 methods)** | Phase 3 | `AddGroupExpenseModal.tsx` | `+ Add Expense` button inside active group view. |
| **Min-Cash-Flow Debt Settlement** | Phase 3 | `GroupsScreen.tsx` + `SettleModal.tsx` | `[ Balances & Settle ]` tab in group view → `Settle Up` button. |
| **Transparent Member Explanation** | Phase 3 | `ExplanationModal.tsx` | Tap any participant's balance card in group Balances tab. |
| **Financial Dependency DAG** | Phase 3 | `GroupsScreen.tsx` (`Graph` tab) | `[ Graph ]` tab inside active group view. |
| **Authentication (Sign In / Register)** | Phase 4 | `AuthModal.tsx` | 1. Header Cloud Sync Pill button on Home (`Guest` badge).<br>2. `Sign In or Register` in Settings → Account & Cloud Sync. |
| **Cloud Sync & Outbox Status** | Phase 4 | Header Pill + `SettingsScreen.tsx` | 1. Cloud status icon in Home top bar (`Synced`, `Sync (N)`).<br>2. Real-time Cloud Sync Card with `Sync Now` in Settings. |

---

## 3. Screen-by-Screen Visual & Functional Inventory

### Screen 1: Onboarding Welcome & Account Setup Flow (`OnboardingModal.tsx`)

* **Trigger:** Fresh app launch when `app_preferences.hasCompletedOnboarding === false`.
* **Step 1 — Welcome Hero:**
  * **Visual Illustration:** Central 3D rendered purple wallet graphic overflowing with golden coins.
  * **Headline:** *"Save your money with Biyong"*
  * **Subtitle:** *"Save money! The more your money works for you, the less you have to work for money."*
  * **Pagination Indicator:** Active dot slider (slide 1 of 2).
  * **CTA Button:** Full-width rounded violet button labeled *"Let's Start"* → transitions to Step 2.
* **Step 2 — Create First Account:**
  * **Headline:** *"Create your first account"*
  * **Subtitle:** *"Add an account to get started"*
  * **Account Name Input:** Text field with placeholder (e.g. `Primary Bank`, `Daily Cash`).
  * **Account Type Selector Chips:** 4 selectable chips with vector icons:
    * `Bank` (`business-outline`)
    * `Cash` (`cash-outline`)
    * `Wallet` (`wallet-outline`)
    * `Credit` (`card-outline`)
  * **Starting Balance Input:** Currency-formatted input (e.g. `₹ 0.00`).
  * **CTA Button:** *"Create Account"* → initializes local account, flags onboarding complete, and enters Home.

---

### Screen 2: Home / Financial Dashboard (`HomeScreen.tsx`)

* **Header Navigation:**
  * **User Avatar Badge:** Left-aligned avatar or guest profile icon.
  * **Month & Period Selector:** Centered dropdown pill (e.g., `November 2025 ⌵`).
  * **Cloud Sync Status Pill (Phase 4):**
    * Compact pill button next to notification icon:
      * Guest mode: `cloud-offline-outline` + *"Guest"* → opens `AuthModal`.
      * Synced state: `cloud-done-outline` (green) + *"Synced"*.
      * Pending sync: `cloud-upload-outline` (amber) + *"Sync (3)"* → triggers immediate `syncNow()`.
  * **Notification Bell:** Vector bell icon (`notifications-outline`).
* **Hero Balance Header Card (Violet Gradient):**
  * **Gradient Surface:** Vibrant violet gradient (`#7C3AED` to `#A855F7`).
  * **Title & Visibility Toggle:** *"Current Balance"* with eye toggle icon (`eye-outline` / `eye-off-outline`).
  * **Net Worth Display:** Large bold typography (e.g., `₹ 87,457.85` or `$ 87,457.85`).
  * **Trend Badge:** Micro-pill showing period delta (e.g., `+₹ 784 than last week` or sparkline indicator).
  * **Interactive Shortcut:** Tapping the balance card navigates directly to `AccountsScreen`.
* **Quick Action Pills Row:**
  * Horizontal row of 4 rounded quick-action buttons with soft backgrounds:
    1. `+ Add Transaction` (violet icon, opens `QuickAddModal` in Expense mode).
    2. `⇄ Transfer` (blue icon, opens `QuickAddModal` in Transfer mode).
    3. `👥 Split / Groups` (green icon, opens `GroupsScreen`).
    4. `💳 Accounts` (purple icon, opens `AccountsScreen`).
* **Cashflow Summary Card:**
  * Dual-column card with subtle separator:
    * **Income:** Emerald green down-left arrow icon, label *"Income"*, amount `₹ 95,000`.
    * **Expenses:** Coral red up-right arrow icon, label *"Expenses"*, amount `₹ 42,350`.
  * Tap card → jumps to `ReportsScreen`.
* **Safe-to-Spend Gauge Widget (Phase 2):**
  * Circular progress ring indicating monthly allowance adherence (e.g., `72%`).
  * In-card stats: Safe spending remaining (e.g., `₹ 28,650 of ₹ 50,000`), days remaining badge (`24 days left`).
* **Recent Transactions Feed:**
  * Section header: *"Transactions"* with period indicator tag and *"See All"* link (navigates to `TransactionsScreen`).
  * Date headers (e.g., `Today, 5 Nov 2025`, `Yesterday, 4 Nov 2025`).
  * **Transaction Row Component (`TransactionItem.tsx`):**
    * Left: Category circular icon badge (e.g., `restaurant-outline`, `briefcase-outline`, `cart-outline`).
    * Center: Merchant / category title (bold), subtitle showing account tag & timestamp (e.g., `ICICI Bank • 12:45 PM`).
    * Right: Color-coded signed amount (Green `+₹ 50,000.00` for income, Red `-₹ 520.00` for expense, Blue for transfer).
    * Tap row → opens `TransactionDetailSheet.tsx`.

---

### Screen 3: Accounts Management (`AccountsScreen.tsx`)

* **Header:**
  * Screen title: *"Accounts: Manage your money"*.
  * Primary Action: `+ Add` button triggering `AddAccountModal`.
* **Total Balance Hero Card:**
  * Aggregated net worth across all liquid and credit accounts (e.g., `₹ 87,457.85`).
  * Monthly growth trend indicator with mini sparkline.
* **Accounts List:**
  * Cards grouped or categorized by account type:
    * **Bank Accounts:** Bank building icon, account name (e.g., `Primary Bank`, `SBI Savings`), balance (`₹ 52,340.00`).
    * **Cash Wallets:** Cash icon, wallet name (`Cash Wallet`), balance (`₹ 12,250.00`).
    * **Credit Cards:** Card icon, name (`HDFC Credit Card`), negative liability balance (`-₹ 8,400.00`).
  * **Card Actions:**
    * Tap account → filters ledger to show only this account's transactions.
    * Delete account button (with safety guard preventing deletion if transactions exist).

---

### Screen 4: Transactions Ledger & Activity (`TransactionsScreen.tsx`)

* **Header:**
  * Screen title: *"Transactions: Ledger"*.
  * Quick add shortcut button (`+`).
* **Search & Filter Bar:**
  * Instant text search field: searches merchant names, descriptions, and notes in real time.
  * Filter icon button opening filter chips:
    * Type filters: `All`, `Expenses`, `Income`, `Transfers`.
    * Category filter dropdown.
    * Account filter dropdown.
* **Date-Grouped Transaction Feed:**
  * Sticky date headers (e.g., `Today, 5 Nov 2025`, `Yesterday, 4 Nov 2025`, `2 Nov 2025`).
  * Complete transaction rows showing category icon, title, source account, timestamp, and signed amount.
  * Tap row → opens `TransactionDetailSheet`.

---

### Screen 5: Transaction Detail & Action Sheet (`TransactionDetailSheet.tsx`)

* **Trigger:** Tapping any transaction row in the Ledger or Home feed.
* **Header Card:**
  * Category icon badge, merchant / transaction title (e.g., `Balaji Vegetables`), formatted amount (`₹ 300.00`), timestamp.
* **Metadata Section:**
  * `Transfer Details`: Unique Transaction ID (`tx_xxxx...`), Debited/Credited Account (`Debited from ICICI Bank`).
  * `Category & Notes`: Assigned category and optional user note.
  * `Remove from Expense Toggle`: Switch to exclude this transaction from spending reports without deleting the ledger record.
* **Action Buttons Bar:**
  1. `Share Receipt` (Green button) — Generates shareable summary text.
  2. `Split Money` (Purple button) — Direct shortcut launching Group Split flow pre-filled with this transaction's amount.
  3. `Delete Transaction` (Red/Orange button) — Prompts confirmation dialog to delete from SQLite ledger.

---

### Screen 6: Reports & Advanced Financial Analytics (`ReportsScreen.tsx`)

* **Header:**
  * Navigation title: `< Report` / `Overview`.
  * Date range / Month picker dropdown (e.g., `Nov 2025 ⌵`).
* **View Controls:**
  * Segmented Pill Switch: `[ Expenses ]` vs `[ Income ]`.
  * Visualization Mode Toggle: Donut Chart icon vs Bar Chart icon.
* **Visualizations:**
  * **Donut Chart View:**
    * Center key metric: `Total Expenses ₹ 42,350.00`.
    * Multi-color segmented slices (Purple, Cyan, Green, Orange) with active touch tooltips (e.g., `31%`).
  * **Weekly Spending Bar Chart View:**
    * Vertical bars comparing weekly expenditure across `W1`, `W2`, `W3`, `W4`, `W5`.
* **Category Spending Breakdown List:**
  * Section header: *"Category Breakdown"* with total sum.
  * **Category Cards:** Category icon, title (e.g., `Food & Dining`, `Shopping`, `Transport`), percentage share (`32%`), month-over-month trend badge (`+12% vs last month`), monetary total (`₹ 13,552.00`), and horizontal progress bar.
* **Fixed vs Variable Spending Breakdown Card (Phase 2):**
  * Two-column breakdown: Fixed expenses (recurring bills, rent, utilities) vs Variable expenses (dining, entertainment, shopping).
  * Two-color segmented horizontal bar illustrating percentage split.
  * Clear explanatory note helping non-techy users budget smarter.
* **6-Month Spending Trends & Savings Rate (Phase 2):**
  * Historical multi-month chart/table showing Income vs Expenses vs Net Savings for the past 6 months.
  * Savings Rate percentage badge for each period (e.g., `Savings Rate: 34%`).

---

### Screen 7: Plan Hub — Budgets & Goals (`BudgetsGoalsScreen.tsx` / `PlanScreen.tsx`)

* **Header:**
  * Navigation title: *"Plan"*.
  * Segmented Pill Switcher: `[ Budgets ]` | `[ Goals ]`.
* **Sub-View A: Category Budgets:**
  * **Monthly Budget Overview Card:**
    * Total Budgeted vs Total Spent, remaining balance.
    * Overall adherence progress bar (e.g., `₹ 28,450 / ₹ 50,000`, `57%`).
  * **Category Budget Cards:**
    * Category icon and title (e.g., `Food & Dining`, `Shopping`, `Transport`, `Entertainment`).
    * Budgeted ratio (`₹ 6,320 / ₹ 10,000`).
    * **Circular Progress Ring Badge / Bar:** Color-coded by health status:
      * Emerald `Healthy` (<80% spent).
      * Amber `Warning` (80%–99% spent).
      * Red `Exceeded` (≥100% spent).
    * Daily Spending Allowance: `"₹ 204 / day remaining (18 days left)"`.
    * Rollover Indicator Badge: `"Rollover on"` if unspent balance carried forward from previous period.
    * Delete budget button.
  * Floating CTA Button: `+ Add Budget` → opens `AddBudgetModal.tsx`.
* **Sub-View B: Savings Goals:**
  * **Overview Header Card:**
    * Total Saved across all goals vs Combined Target.
  * **Goal Cards:**
    * Title & icon (e.g., `Goa Trip`, `New Laptop`, `Emergency Fund`).
    * Target Date badge (e.g., `Target: Dec 2026`).
    * Saved vs Target progress bar with percentage (`₹ 32,000 / ₹ 50,000`, `64%`).
    * Schedule Alert Banner:
      * Emerald pill: `"On track for target date"`.
      * Coral warning banner: `"⚠️ You're 30% behind schedule and off target"`.
    * Required Monthly Savings: `"Need ₹ 4,500 / month to hit target on time"`.
    * Projected Completion Date: Estimated date based on current contribution rate.
    * Action Buttons:
      * `+ Contribute` (opens `ContributeGoalModal.tsx`).
      * Delete goal action.
  * Floating CTA Button: `+ Add Goal` → opens `AddGoalModal.tsx`.

---

### Screen 8: Private Groups, Splits & Settlements (`GroupsScreen.tsx`)

* **State A: Groups Directory (When no active group is selected):**
  * Header: Title *"Groups & Splits"*, subtitle *"100% offline, private group expense management"*.
  * Groups Card List:
    * Group title (e.g., `Goa Trip 2026`, `Roommates Flat 402`).
    * Member count chip and total group spend (`₹ 54,200.00`).
    * Tap card → enters Active Group Workspace.
    * Delete group button with confirmation dialog.
  * Primary CTA Button: `+ Create new group` → opens `AddGroupModal.tsx`.
* **State B: Active Group Workspace (When a group is selected):**
  * **Header:**
    * `< All Groups` back button, Group Name, Currency badge (`INR`).
    * Group Total Spend summary badge and member count.
  * **Sub-Tab Switcher:**
    * `[ Expenses ]` | `[ Balances & Settle ]` | `[ Graph ]`
  * **Tab 1: Expenses:**
    * List of group expenses with title, date, paid-by member name, split method badge (`Equal`, `Exact`, `Percentage`, `Shares`), and amount.
    * Delete expense action.
    * Floating CTA: `+ Add Expense` → opens `AddGroupExpenseModal.tsx`.
  * **Tab 2: Balances & Settle:**
    * **Member Net Balances:**
      * Member cards showing net standing:
        * `Gets Back ₹ 3,450.00` (Emerald badge for creditors).
        * `Owes ₹ 1,200.00` (Red badge for debtors).
        * `Settled Up ₹ 0.00` (Gray badge).
      * Tap any member card → opens `ExplanationModal.tsx` displaying complete mathematical breakdown of paid vs allocated shares across all expenses.
    * **Greedy Min-Cash-Flow Simplified Settlements:**
      * Explanatory badge: *"Debts simplified into minimum transactions using min-cash-flow algorithm."*
      * Simplified transfer cards: `"Bob pays Alice: ₹ 1,200.00"`.
      * Primary CTA: `Settle Up` → opens `SettleModal.tsx` prefilled with payer, payee, and amount.
      * When all balances reach zero: Full-width celebration card *"All settled up! Everyone is even."*
  * **Tab 3: Dependency Graph:**
    * Visual Directed Acyclic Graph (DAG) summary of members and expense nodes, showing cash flow dependencies and verifying zero-sum balance.

---

### Screen 9: Settings, Authentication & Cloud Sync (`SettingsScreen.tsx`)

* **Account & Cloud Sync Section (Phase 4):**
  * **Guest Mode State (`isGuest === true`):**
    * Card: *"Guest Mode (100% Offline)"*.
    * Subtitle: *"Your financial ledger is saved on this device. Sign in or register to sync across devices."*
    * Button: `Sign In or Register` → opens `AuthModal.tsx`.
  * **Authenticated User State (`user !== null`):**
    * Profile Card: User avatar, Name, Email, Device ID badge (`device_xxxx`).
    * **Cloud Sync Card:**
      * Real-time sync status badge:
        * `Synced` (emerald green).
        * `Pending Changes` (amber) with count (e.g., `"3 changes waiting to sync"`).
        * `Syncing` (blue with active activity spinner).
      * Last Synced Timestamp: `"Today at 10:45 AM"`.
      * Button: `Sync Now` with loading indicator.
    * Button: `Sign Out` (with confirmation dialog; local data remains safely intact).
* **Appearance & Preferences:**
  * Theme mode toggle: `Light`, `Dark`, `System`.
  * Base currency selector: `INR (₹)`, `USD ($)`, `EUR (€)`.
* **Data & Ledger Management:**
  * `Reset Onboarding`: Re-launch initial welcome guide.
  * `Load Demo Dataset`: Seeds comprehensive accounts, transactions, budgets, goals, and trip groups.
  * `Clear Local Database`: Dual-step confirmation modal to wipe all local records.
* **Technical & Offline Diagnostics (Collapsible Section at Bottom):**
  * SQLite engine status, database file path, active schema version, table record counts, and outbox operations inspection.

---

## 4. Complete Modals & Action Sheets Inventory (12 Modals)

| Modal Name | Component File | Trigger / Purpose | Key UI Inputs & Elements |
| :--- | :--- | :--- | :--- |
| **Onboarding Modal** | `OnboardingModal.tsx` | App launch when first installed | 3D Wallet visual hero, value props, account name input, type selector chips (`Bank`, `Cash`, `Wallet`, `Credit`), starting balance, *"Create Account"* CTA. |
| **Global Quick Add Modal** | `QuickAddModal.tsx` | Center FAB (`+`) or Home quick action | Type selector (`Expense`, `Income`, `Transfer`), large amount display (`₹ 0.00`), category selector grid/dropdown, account picker, date picker, note field, *"Save Transaction"* CTA. |
| **Add Account Modal** | `AddAccountModal.tsx` | `+ Add` button in Accounts screen | Account name, account type selector (`Bank`, `Cash`, `Wallet`, `Credit`), initial balance input, currency selector. |
| **Transaction Detail Sheet** | `TransactionDetailSheet.tsx` | Tapping any transaction row | Transaction ID, debited/credited account, category badge, "Remove from Expense" toggle, `Share Receipt`, `Split Money`, `Delete Transaction`. |
| **Add Budget Modal** | `AddBudgetModal.tsx` | `+ Add Budget` button in Plan tab | Category picker (filtered to expense categories), spending limit amount, period selector (`Monthly` vs `Weekly`), Rollover toggle switch. |
| **Add Goal Modal** | `AddGoalModal.tsx` | `+ Add Goal` button in Plan tab | Goal title, target amount, initial saved balance, target date picker with quick helper presets (`3 Months`, `6 Months`, `1 Year`). |
| **Contribute Goal Modal** | `ContributeGoalModal.tsx` | `Contribute` button on Goal card | Goal progress summary, amount input to contribute, quick percentage chips, *"Confirm Contribution"* button. |
| **Add Group Modal** | `AddGroupModal.tsx` | `+ Create new group` in Groups screen | Group name input, currency selector (`INR`), member name input with `+ Add Member` chip builder and remove chip buttons. |
| **Add Group Expense Modal** | `AddGroupExpenseModal.tsx` | `+ Add Expense` in active group | Expense title, amount, date, Paid By selector (Single member or Multi-payer allocation), Split Method selector (`Equal`, `Exact`, `Percentage`, `Shares`), dynamic member allocation inputs with sum validation. |
| **Settle Modal** | `SettleModal.tsx` | `Settle Up` on simplified transfer card | Payer member selector, Receiver member selector, amount input (prefilled), note input, *"Confirm Settlement"* CTA. |
| **Explanation Modal** | `ExplanationModal.tsx` | Tapping any member balance card | Mathematical audit trail: total paid across all expenses vs total allocated share, settlements made/received, net balance, and itemized breakdown of contributing expenses with net impact (+/-). |
| **Auth Modal** | `AuthModal.tsx` | Cloud Sync pill on Home or Settings | Segmented toggle: `Sign In` vs `Create Account`, Full Name (for registration), Email, Password, Guest Data Upgrade banner explaining automatic linking of local data, *"Continue as Guest"* dismiss. |

---

## 5. UI & Design System Recommendations for Figma Hand-Off

1. **Card Elevation & Border Hierarchy:**
   * Light mode: Card surface `#FFFFFF` with 1px border `#F1F5F9` and ambient shadow (`shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2`).
   * Dark mode: Card surface `#1E293B` with 1px border `#334155`.
2. **Tab Bar Floating Center Alignment:**
   * The central `+` FAB is elevated 16dp above the tab bar in a circular violet container (`#8B5CF6`) with a subtle drop shadow.
3. **Data Visualizations:**
   * **Donut Charts:** 24dp stroke thickness with rounded caps and central summary figure.
   * **Progress Rings:** Used for budget adherence and safe-to-spend widgets; semi-transparent track with vibrant color fill.
4. **Numeric Typography:**
   * Always enforce tabular figures (`fontVariant: ['tabular-nums']`) across all currency figures for clean vertical alignment.
5. **Multi-Payer Expense Splits:**
   * Real-time sum-validation indicators (green checkmark when member shares sum to 100% or total amount; amber alert when discrepant).
