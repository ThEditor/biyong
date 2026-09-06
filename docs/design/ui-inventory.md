# Biyong — Comprehensive Mobile UI Specification & Screen Inventory

> **Document Purpose:** Complete architectural and visual inventory of every screen, modal, sub-view, component, and interaction in the Biyong mobile application. Designed as the primary handoff reference for product designers to create refined visual design mockups, design systems (Figma), and UX improvements.

---

## 1. Design System & Foundational Principles

### 1.1 Core Aesthetic Guidelines

1. **Modern Purple Fintech Aesthetic:** High data density wrapped in a clean, soft-card interface using violet gradients (`#7C3AED` to `#9333EA`), crisp white cards, generous touch targets (minimum 44x44 dp), and soft ambient drop shadows.
2. **Multi-Currency Precision:** Every monetary figure is formatted with explicit symbol positioning and locale rules (e.g., `$87,457.85`, `₹ 27,678`, `Cash, EUR -354.25$`).
3. **Selective Visual Micro-Badging:** Primary UI relies on clean vector icons (`Ionicons` & `Feather`), complemented by contextual badges (e.g., `✨ Your insight is ready`).
4. **Safe Area Inset Protection:** All views strictly observe `useSafeAreaInsets()`. Screen content never collides with or bleeds underneath the status bar, camera notch, Dynamic Island, or Android gesture navigation pill.
5. **Clean Zero-Data Start:** Fresh installs boot into an onboarding flow featuring 3D visual assets to guide initial account setup.
6. **Isolated Technical Diagnostics:** System stats, SQLite engine logs, and database metrics are strictly quarantined to the Settings screen.

### 1.2 Color Themes & Accent Presets

The app supports 3 Theme Modes powered by centralized design tokens (`ThemeContext.tsx`):

* **Modes:** `Light`, `Dark`, `System`
* **Primary Gradient Tokens:**
* Hero Header Card: Soft Electric Purple to Magenta (`#7C3AED` → `#C084FC`)
* Accent FAB: Electric Violet (`#8B5CF6`)


* **Backgrounds:**
* Light Canvas: Soft Cool Gray (`#F8FAFC` / `#F1F5F9`), Surface Card (`#FFFFFF`)
* Dark Canvas: Charcoal / Deep Navy (`#0F172A` / `#1E293B`)


* **Semantic Financial Colors:**
* Income / Surplus / Healthy: Emerald Green (`#10B981`)
* Expense / Debt / Exceeded: Crimson Red / Coral (`#EF4444` / `#F97316`)
* Warning / Behind Target: Warm Amber (`#F59E0B`)
* Informational / Tags: Slate Blue & Cyan (`#0EA5E9` / `#6366F1`)



---

## 2. Navigation Architecture

### Persistent Bottom Bar

The application uses a **4-Tab Navigation Bar with an Elevated Central Floating Action Button (FAB)**:

| Tab ID | Label | Icon | Primary Screen Component | Key Sub-Views & Roles |
| --- | --- | --- | --- | --- |
| `home` | **Home** | `home` | `HomeScreen` | Total Balance Banner, Cashflow Split, Safe-to-Spend Ring, Recent Transactions |
| `reports` | **Report** | `bar-chart` | `ReportsScreen` | Donut & Weekly Bar Charts, Category Breakdown, Top Spend Areas |
| `fab` | *(Center FAB)* | `add` (`+`) | *Global Quick Add* | Triggers Quick Add / Expense Entry Modal |
| `plan` | **Plan** | `wallet` / `clipboard` | `PlanScreen` | Savings Goals with Sliders & Category Budgets with Progress Rings |
| `settings` | **Settings** | `settings` | `SettingsScreen` | Theme Modes, Currency Settings, Security, Offline Database Diagnostics |

---

## 3. Screen-by-Screen Visual Inventory

### Screen 1: Onboarding Welcome Flow (`OnboardingModal.tsx`)

* **Trigger:** App launch when `app_preferences.hasCompletedOnboarding === false`.
* **Layout:** Fullscreen card with centered 3D visual graphics.
* **Visual Elements:**
* **Illustration:** Central 3D rendered wallet asset filled with coins.
* **Headline:** *"Save your money with Expense Tracker"*
* **Subtitle:** *"Save money! The more your money works for you, the less you have to work for money."*
* **CTA Button:** Full-width rounded Purple button labeled *"Let's Start"* → transitions to first account setup and Home.



---

### Screen 2: Home / Financial Dashboard (`HomeScreen.tsx`)

* **Header Navigation:**
* Profile avatar badge (top-left).
* Date / Period Dropdown picker (e.g., `November 2025 v` or `APRIL 2023`).
* Notification bell icon (top-right).


* **Hero Balance Header Card:**
* **Gradient Banner Variant:** Violet-to-purple header displaying `Current Balance` (e.g., `$87,457.85`) with trend subtitle (e.g., `+$784 than last week`).
* **Alternative Card Variant:** Floating card displaying `Total Balance` with quick options menu.


* **Cashflow & Safe-to-Spend Cards:**
* **Your Money Split Card:** Dual sub-cards showing total `Income` (`$4,875.12`) and `Expenses` (`$8,145.78`) with a `Details >` shortcut link.
* **Safe to Spend Gauge Widget:** Circular progress ring indicating safe daily balance (e.g., `Safe to Spend ₹ 27,678` with `24 days left`).


* **AI Insight Banner:**
* Dark rounded pill card: `✨ Your insight is ready` with a `Get Pro >` action button.


* **Recent Transactions Section:**
* Section header: `Transactions` with period indicator badge (e.g., `For the Period`) and section total sum.
* **Transaction Row Item:**
* Left: Category circular icon badge.
* Center: Merchant or category name, tag pills (e.g., `Red Card`, `Vacation`, `ICICI Bank xxxx6579`), and timestamp.
* Right: Color-coded signed amount (e.g., `-354.25$` red expense, `+$1200` green income).





---

### Screen 3: Reports & Advanced Analytics (`ReportsScreen.tsx`)

* **Header:**
* Back navigation button `< Report` / `< Overview`.
* Date range / Month picker dropdown (`November 2025 v`).


* **View Controls:**
* **Segmented Pill Toggle:** Switch between `[ Expenses ]` and `[ Income ]`.
* **Visualization Toggle:** Switch between Donut Chart view and Bar Chart view.


* **Chart Views:**
* **Donut Chart View:**
* Center key metric: `Total Expenses $42,124.67`.
* Multi-color segmented slices (Purple, Cyan, Green, Orange) with active touch tooltips (e.g., `31%`).


* **Weekly Bar Chart View:**
* Dual vertical bar chart comparing weekly Income (Purple) vs. Expenses (Orange) across `Week 1` through `Week 4`.




* **Category Spending Breakdown List:**
* Header: `All Expenses` with aggregate sum total.
* **Category Cards:** Category icon, title (e.g., `Groceries`, `Clothing & Shoes`), percentage share (`31% of total`), month-over-month trend badge (`+12% vs last month`), monetary total (`$8,750.00`), and bottom progress bar indicator.


* **Top Spend Areas Sub-View:**
* Ranked expenditure list displaying total category spend and relative progress bars (`Cash Withdrawal`, `Food & Beverages`, `Transport`).



---

### Screen 4: Plan Hub — Goals & Budgets (`PlanScreen.tsx`)

* **Header:**
* Navigation title `< My Plan`.
* Quick action toolbar: `+` create button and export/more options menu.


* **Section 1: Savings Goals (`Goals`):**
* Section title with `View All` shortcut.
* **Goal Card:**
* Title & icon (e.g., *"House by the Sea"*).
* Saved amount indicator (`$8,750.00 Out of $1,750.00`).
* Custom slider progress bar with handle indicator.
* Schedule Alert Banner: Red/Orange warning pill (e.g., `⚠️ You're 30% behind schedule and off target.`).




* **Section 2: Category Budgets (`Budgets`):**
* Section title with `View All` shortcut.
* **Budget Cards:**
* Left: Category icon and title (*"Save for a Car"*, *"Save for Education"*, *"Vacation fund"*).
* Center: Budgeted ratio (`$2500 of $7500`).
* Right: **Circular Progress Ring Badge** showing percentage consumed (e.g., `55%`, `25%`, `65%`).





---

### Screen 5: Transaction Detail & Quick Actions Sheet (`TransactionDetailSheet.tsx`)

* **Trigger:** Tapping any transaction row in the Ledger or Home feed.
* **Header:** Category icon selector, title (e.g., `Balaji Vegetables`), transaction amount (`₹ 300`), and timestamp.
* **Metadata Section:**
* `Transfer Details`: Transaction ID (`6537543346424`), Payment source (`Debited from ICICIXXXXXXXX4567`).
* `Remove from Expense`: Toggle switch to exclude from reports without deleting the record.


* **Quick Action Bar (3 Action Buttons):**
* `Share Receipt` (Green button)
* `Split Money` (Purple button → opens Split Payment View)
* `View History` (Orange button)



---

### Screen 6: Split Payment & Group Expenses (`SplitPaymentScreen.tsx`)

* **Header:**
* Navigation back button `< Split Payment`.
* Subtitle: *"With a group of friends or individual"*.


* **Payment Banner Card:**
* Prompt: `You Paid ₹ 27,00`.
* Description field: *"What's this payment for?"*


* **Group Action Bar:**
* Instant transaction search input.
* Primary Button: `+ Create new group` (Green icon button).


* **Contacts & Participants List (`All Contacts`):**
* Searchable list showing participant avatar chips (e.g., `AJ`, `AM`, `AR`), full names (*Ajay singh*, *Aman*, *Arjit Bose*), and phone numbers.



---

### Screen 7: Settings & Offline Diagnostics (`SettingsScreen.tsx`)

* **Appearance & Preference Settings:**
* Theme mode toggle (`Light`, `Dark`, `System`).
* Default currency selector (`USD ($)`, `EUR (€)`, `INR (₹)`).


* **Data & Ledger Management:**
* Reset onboarding flow.
* Load demo dataset.
* Clear local database with dual-step confirmation.


* **Technical & Offline Diagnostics:**
* SQLite Engine status, active schema version, and local database record counts.



---

## 4. Complete Modals & Action Sheets Inventory

| Modal / Sheet Name | Trigger / Purpose | Key UI Elements |
| --- | --- | --- |
| **Global Quick Add Modal** | Central Floating Action Button (`+`) on Tab Bar | Numeric keypad, category icon picker, `Income` / `Expense` / `Transfer` toggle, account picker, note field. |
| **Transaction Detail Sheet** | Tapping any transaction item | Metadata card, Transaction ID, debited account, expense toggle switch, `Share Receipt`, `Split Money`, `View History` actions. |
| **Split Payment View** | `Split Money` action button | Payer amount display (`You Paid`), description field, `+ Create new group` CTA, contact list with avatar chips. |
| **Add Goal Modal** | `+` button in Plan tab (Goals section) | Goal title input, target amount, target date selector, initial contribution slider. |
| **Add Budget Modal** | `+` button in Plan tab (Budgets section) | Category selector, spending limit input, monthly/weekly period toggle. |
| **Onboarding Modal** | Initial launch / Fresh install | 3D Wallet visual hero, value proposition, setup call-to-action button (*"Let's Start"*). |

---

## 5. UI & Design System Recommendations for Figma Hand-Off

1. **Card Elevation & Border Hierarchy:**
* Use soft background card fills (`#FFFFFF` in light mode, `#1E293B` in dark mode) paired with subtle ambient drop shadows (`shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10`).


2. **Tab Bar Floating Center Alignment:**
* The central `+` FAB should be positioned in a circular cut-out / floating container raised 16dp above the persistent bottom navigation bar.


3. **Data Visualizations:**
* **Donut Charts:** Ring thickness set to 24dp with rounded arc caps and interactive center text for key summary totals.
* **Progress Rings:** Use semi-transparent background rings with vibrant foreground fills for category budget completion status.


4. **Numeric Typography:**
* Enforce fixed-width tabular numbers (`fontVariant: ['tabular-nums']`) across all transaction lists and financial reports to ensure clean vertical decimal alignment.
