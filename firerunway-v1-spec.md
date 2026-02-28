# FireRunway — V1 Product Specification

## Overview

FireRunway is a financial independence dashboard for senior tech workers. It connects to brokerage and retirement accounts, models RSU/equity compensation, calculates a Financial Independence score, and runs Monte Carlo simulations to answer one core question: **how much longer do I need to keep working?**

This document is the V1 build spec. It covers screens, components, data model, APIs, and design direction.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Charts | Recharts + custom canvas animations |
| Auth | Clerk |
| Account Aggregation | SnapTrade API |
| Market Data | Polygon.io |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Database | Supabase (Postgres) |
| Hosting | Vercel |

---

## Design Direction

**Aesthetic:** Premium dark-mode developer tool. Think Linear meets Bloomberg terminal. Sharp, data-dense, confident. Not a bank website, not a generic SaaS dashboard.

**Theme:**
```css
--bg-primary: #0a0a0f;
--bg-surface: #111118;
--bg-elevated: #1a1a24;
--border: #2a2a3a;
--text-primary: #f0f0ff;
--text-secondary: #8888aa;
--accent: #6366f1; /* indigo */
--accent-green: #10b981;
--accent-amber: #f59e0b;
--accent-red: #ef4444;
```

**Typography:**
- Display / headings: `DM Serif Display` (Google Fonts)
- Body / UI: `JetBrains Mono` for numbers, `DM Sans` for labels
- All numbers monospaced for alignment

**Motion:**
- Charts animate in on mount (staggered, 600–900ms)
- Number counters animate from 0 to value on first load
- Tab transitions: slide + fade
- Hover states on all interactive elements
- No looping animations — motion is purposeful, not decorative

**Layout:**
- Max width 1400px, centered
- Persistent top navigation bar
- Left sidebar for secondary nav on desktop, bottom tab bar on mobile
- Cards use subtle glass morphism: `background: rgba(255,255,255,0.03)`, `border: 1px solid var(--border)`

---

## User Onboarding Flow

### Screen 1 — Welcome
- Single headline: *"Know if you're financially independent — before you find out the hard way"*
- One CTA: **Get Started**
- No feature lists, no pricing, no noise

### Screen 2 — Create Account
- Clerk-powered auth
- Email + password or Google SSO
- MFA prompt after signup

### Screen 3 — Connect Accounts
- SnapTrade OAuth flow embedded in an iframe/modal
- Checklist UI showing account types to connect:
  - [ ] Brokerage (Schwab, Fidelity, E*Trade, etc.)
  - [ ] 401k / Retirement
  - [ ] IRA / Roth IRA
- "Skip for now" option — allows manual input
- Progress indicator: Step 1 of 4

### Screen 4 — RSU Setup
- Form fields:
  - Employer company name (autocomplete against list of public companies + ticker lookup via Polygon)
  - Grant date
  - Total shares granted
  - Shares already vested
  - Vesting schedule: `4-year / 1-year cliff` (default), custom
  - Additional grants: `+ Add Another Grant` button
- Option: **Upload Grant Document** → AI parses vesting schedule via Claude API
- Progress indicator: Step 2 of 4

### Screen 5 — Real Estate Setup
- Add properties manually:
  - Property address
  - Property type: Primary Residence / Rental / Vacation
  - Purchase price and date
  - Current estimated value (manual entry — Zillow/Zestimate lookup button via RapidAPI)
  - Mortgage balance outstanding
  - Monthly mortgage payment (P&I)
  - Monthly rental income (for investment properties)
  - Mortgage interest rate and remaining term
- `+ Add Another Property` button for multiple properties
- Progress indicator: Step 3 of 5

### Screen 6 — Your Numbers
- Annual gross income (salary, excluding RSUs)
- Current annual spend / expenses
- Expected annual spend in retirement
- Target FIRE date (optional — system will calculate if blank)
- State of residence (for tax rate calculations)
- Filing status: Single / Married Filing Jointly
- Progress indicator: Step 4 of 5

### Screen 7 — First Look (Payoff Screen)
- Animated reveal of their FI Score
- Net worth breakdown: Investments + Real Estate Equity + RSU Value
- FIRE date projection (base case)
- Runway in years
- CTA: **Go to Dashboard**
- Progress indicator: Step 5 of 5

---

## Navigation Structure

```
Top Bar
├── Logo / Brand
├── FI Score (always visible — e.g. "72")
├── Net Worth (always visible — e.g. "$3.2M")
└── User avatar → Settings

Main Navigation (left sidebar desktop / bottom tabs mobile)
├── Dashboard (home icon)
├── Net Worth (trending up icon)
├── Portfolio (pie chart icon)
├── Real Estate (home icon)
├── Equity / RSUs (stock icon)
├── FIRE Score (flame icon)
└── Monte Carlo (chart icon)
```

---

## Screen 1 — Dashboard (Home)

### Purpose
Answer in 5 seconds: *Am I okay?*

### Layout

**Hero Row — 3 large stat cards**

| Card | Value | Subtext |
|---|---|---|
| FI Score | `72 / 100` with animated arc gauge | "Approaching independence" |
| Runway | `14.2 years` | "If income stopped today" |
| FIRE Gap | `$340K away` | "Base case: 2028" |

**"If Laid Off Tomorrow" Card**
Full-width card below hero. Shows:
- ✅ Mortgage covered: 14+ years
- ✅ Emergency fund: 18 months liquid
- ⚠️ Unvested RSUs at risk: $180,000
- ⚠️ Healthcare gap: COBRA ~$1,800/mo until Medicare

Logic:
- Green check: item is covered for 5+ years
- Amber warning: item is covered 1–5 years or has a known gap
- Red alert: item is uncovered or immediately at risk

**AI Insights Feed**
3 cards, each with a short AI-generated observation based on live data:
- Next RSU vest event
- Concentration risk flag if employer stock > 20% of net worth
- FIRE trajectory status

Each insight has a "Tell me more →" link that expands an AI chat panel with context.

**Quick Links Row**
- View Portfolio →
- Run Monte Carlo →
- Model a Layoff →

### Data Required
- FI Score (calculated — see FIRE Score screen)
- Total net worth (sum of all connected accounts + RSU value + real estate equity)
- Runway (liquid assets ÷ annual spend)
- Unvested RSU value (shares × current price)
- FIRE gap (FIRE number − current investable assets)
- Mortgage balance, monthly payment (user input, real estate screen)

---

## Screen 2 — Net Worth

### Purpose
A single, always-current view of total net worth across every asset class. The number that answers: *what am I actually worth today?*

### Layout

**Hero — Total Net Worth**
Large animated number at the top: `$4,820,000`
Below it: a sparkline showing net worth over the past 12 months. Click to expand to full chart.

Change indicators: `+$142,000 this month (+3.0%)` in green.

**Asset Breakdown — Waterfall / Stacked Bar**
A horizontal stacked bar showing composition of net worth, animated in on load. Each segment is a distinct color and labeled:

| Asset Class | Value | % of Total |
|---|---|---|
| Investment Accounts | $2,100,000 | 43.6% |
| Retirement Accounts | $980,000 | 20.3% |
| Real Estate Equity | $1,340,000 | 27.8% |
| RSU Value (vested) | $280,000 | 5.8% |
| Cash & Other | $120,000 | 2.5% |
| **Total Assets** | **$4,820,000** | |

Below the assets, liabilities in red:

| Liability | Value |
|---|---|
| Mortgage(s) | −$860,000 |
| **Net Worth** | **$3,960,000** |

**Net Worth Over Time Chart**
A full-width animated line chart. Time toggles: 3M / 6M / 1Y / 3Y / All.

Data points are reconstructed from:
- Daily portfolio snapshots (from SnapTrade syncs)
- Real estate values (updated when user manually refreshes or monthly estimate)
- RSU values (daily stock price × vested shares)
- Mortgage balance (amortized from user inputs, updated monthly)

Hover tooltip shows breakdown by asset class at any point in time.

**Milestone Markers**
Vertical dashed lines on the chart at meaningful moments:
- When portfolio crossed $1M, $2M, $3M
- RSU vesting events
- Property purchases

**Asset Class Cards**
Four summary cards below the chart, each linking to the relevant screen:
- 📈 Investments → Portfolio screen
- 🏠 Real Estate → Real Estate screen
- 💼 Equity Comp → Equity screen
- 💰 Cash & Other → manual entry inline

### Data Required
- Account balances: **SnapTrade** (synced daily)
- RSU vested value: calculated from grant data + **Polygon.io** price
- Real estate values and mortgage balances: user input + optional Zillow estimate
- Historical net worth: stored daily snapshot in `net_worth_history` table

---

## Screen 3 — Portfolio


### Purpose
See all investments in one place, understand current vs recommended allocation.

### Tab 1 — Holdings

**Account Buckets**
Three expandable cards:

1. **Taxable Brokerage**
   - List of positions: ticker, shares, current price, value, 1-day change, gain/loss
   - Total value, total gain/loss
   
2. **Tax-Advantaged** (401k, IRA, Roth IRA)
   - Same position list
   - Annual contribution progress bar: `$18,500 / $23,000 (80%)`
   
3. **Equity Compensation**
   - Vested unsold RSU shares
   - Link to Equity screen for full detail

**Totals Bar** (sticky at bottom)
- Total portfolio value
- Total unrealized gain/loss
- Last synced timestamp

### Tab 2 — Allocation

**Two donut charts side by side, animated on mount:**

Left: *Your Current Allocation*
- US Equity: 72%
- International: 8%
- Bonds: 3%
- Cash: 5%
- Employer Stock: 12%

Right: *Recommended for Your Profile*
- Calculated based on: age, years to FIRE target, risk profile
- Uses a standard glide path model (aggressive → conservative as FIRE approaches)
- Labeled: "Based on a 2028 target date and moderate risk tolerance"

**Gap Analysis**
A horizontal bar chart below the donuts showing the delta between current and recommended for each category. Green = overweight, red = underweight.

**Recommended ETFs Section**
For each allocation category, show a comparison table of 3 low-cost options:

| Category | ETF | Expense Ratio | 10yr Return |
|---|---|---|---|
| US Equity | VTI | 0.03% | 12.1% |
| US Equity | VOO | 0.03% | 12.3% |
| US Equity | SCHB | 0.03% | 12.0% |

*Disclaimer: "This is educational information, not personalized investment advice."*

### Tab 3 — Performance

- Portfolio value over time: 1M / 3M / 6M / 1Y / All
- Animated line chart
- Benchmark toggle: compare vs S&P 500, Total Market

### Data Required
- Holdings, quantities, cost basis: **SnapTrade**
- Current prices: **Polygon.io**
- ETF metadata (expense ratios, categories): **ETF.com data / static table maintained annually**
- Historical portfolio values: reconstructed from SnapTrade transaction history

### Allocation Recommendation Logic

```typescript
function getRecommendedAllocation(age: number, yearsToFire: number): Allocation {
  // Equity percentage: 110 - age, adjusted for FIRE proximity
  const baseEquity = Math.min(110 - age, 95);
  const fireAdjustment = yearsToFire < 5 ? -10 : yearsToFire < 10 ? -5 : 0;
  const equityPct = baseEquity + fireAdjustment;
  
  return {
    usEquity: equityPct * 0.7,
    intlEquity: equityPct * 0.3,
    bonds: 100 - equityPct - 5,
    cash: 5,
  };
}
```

---

## Screen 4 — Real Estate

### Purpose
Track property values, mortgage balances, and equity across all properties. Feed real estate equity into net worth and FIRE modeling.

### Layout

**Summary Bar**
Three stat cards at top:

| Card | Value |
|---|---|
| Total Property Value | $2,200,000 |
| Total Mortgage Balance | −$860,000 |
| Total Real Estate Equity | $1,340,000 |

**Property Cards**
One card per property. Expandable. Each shows:

```
┌─────────────────────────────────────────┐
│ 🏠  123 Main St, Seattle WA             │
│     Primary Residence                   │
├─────────────────────────────────────────┤
│  Current Value      $1,400,000          │
│  Purchase Price     $980,000  (2019)    │
│  Appreciation       +$420,000  (+42.9%) │
├─────────────────────────────────────────┤
│  Mortgage Balance   $620,000            │
│  Monthly Payment    $3,840/mo           │
│  Rate               3.25%  (27yr left)  │
│  Equity             $780,000            │
├─────────────────────────────────────────┤
│  [Refresh Estimate]   [Edit]   [Remove] │
└─────────────────────────────────────────┘
```

For rental properties, an additional section:
```
│  Monthly Rent       $3,200/mo           │
│  Annual NOI         $24,800             │
│  Cap Rate           4.1%                │
│  Cash-on-Cash       6.8%                │
```

**"Refresh Estimate" Button**
Calls Zillow RapidAPI to fetch current Zestimate for the address. Updates stored value and shows "Last estimated: Feb 2026."

**Equity Over Time Chart**
A stacked area chart per property showing:
- Property value (top line)
- Mortgage balance (filled from bottom)
- Equity = gap between the two

Toggle between individual properties or combined view. Animated.

**Amortization View**
Expandable per property:
- Amortization schedule for remaining term
- Principal vs interest breakdown per payment
- Projected payoff date
- Total interest remaining
- Extra payment slider: "Pay $500/month extra" → shows new payoff date and interest saved

**Add Property Button**
Opens a slide-over panel with the full property input form.

**FIRE Impact Toggle**
At the bottom:
> *"Your real estate equity of $1,340,000 represents 33.8% of your net worth. Primary residence equity is excluded from your investable FIRE number by default."*

Toggle: `Include home equity in FIRE number: OFF / ON`

### Rental Metrics Logic

```typescript
function calcRentalMetrics(property: RealEstateProperty) {
  const annualRent = property.monthlyRent * 12;
  // Simplified NOI: rent minus estimated expenses (~35% for taxes, insurance, maintenance)
  const noi = annualRent * 0.65;
  const capRate = noi / property.currentValue;
  const annualMortgage = property.monthlyPayment * 12;
  const cashFlow = noi - annualMortgage;
  const cashInvested = property.purchasePrice - property.originalLoanAmount;
  const cashOnCash = cashFlow / cashInvested;
  return { noi, capRate, cashFlow, cashOnCash };
}
```

### Data Required
- Property details: user input
- Current value estimates: **Zillow via RapidAPI** (on-demand)
- Mortgage balance: amortized from user inputs
- Historical values: stored snapshots on each refresh

### New API: Zillow via RapidAPI
- **Endpoint:** `GET /zestimate` via `zillow-com1.p.rapidapi.com`
- **Trigger:** User clicks "Refresh Estimate" — never automatic
- **Cost:** RapidAPI free tier (500 calls/month) sufficient for V1
- **Fallback:** Manual value entry always available
- **Disclaimer shown in UI:** *"Estimates provided by Zillow. Actual value may differ."*

---

## Screen 5 — Equity / RSUs

### Purpose
Understand the full picture of equity compensation — vesting schedule, concentration risk, after-tax proceeds.

### Layout

**Concentration Gauge**
Large arc/radial gauge at top. Shows employer stock as % of total net worth.
- 0–15%: Green — "Well diversified"
- 15–25%: Amber — "Moderate concentration"
- 25%+: Red — "High concentration risk"

Below gauge: total unvested value at current price, total vested unsold value.

**Stock Price Scenario Slider**
A draggable slider: -50% ←→ +50% vs current price.
As user drags, all values on the screen update in real time:
- Unvested value changes
- Concentration % changes
- FIRE date delta shown: "Moves your FIRE date by +/- X months"

**Vesting Timeline**
Horizontal scrollable calendar for next 24 months.
Each vest event shown as a card:
- Date
- Shares vesting
- Estimated gross value
- Estimated after-tax value (calculated using their tax inputs)
- Cumulative after-tax value for the year

**Tax Withholding Note**
Below timeline: "RSUs are taxed as ordinary income at vest. Estimated federal withholding at your bracket: 35%. State: 9.3%."

**Grant Summary Table**
For users with multiple grants:
| Grant | Date | Total | Vested | Unvested | Unvested Value |
|---|---|---|---|---|---|
| Grant A | Jan 2022 | 1,000 | 750 | 250 | $47,500 |
| Grant B | Jan 2024 | 500 | 125 | 375 | $71,250 |

### Data Required
- Grant schedules: user input / AI-parsed document
- Current stock price: **Polygon.io**
- User's tax bracket and state: user profile inputs
- Total net worth: calculated across all screens

---

## Screen 6 — FIRE Score

### Purpose
A single, honest answer to "am I financially independent?"

### Layout

**The Score**
Full-width hero. Large animated number: `72`
Below it: a horizontal progress bar from 0–100 with labeled milestones:
- 0: "Starting out"
- 25: "Building base"
- 50: "Halfway"
- 75: "Approaching FI"
- 100: "Financially independent"

**Score Breakdown Card**
How the score is calculated, shown as a transparent table:

| Factor | Your Value | Weight | Points |
|---|---|---|---|
| Portfolio vs FIRE number | 74% funded | 40% | 29.6 |
| Runway (years) | 14.2 yrs | 25% | 20.0 |
| Concentration risk | 31% (high) | 15% | 7.5 |
| Income stability | Employed | 10% | 8.0 |
| Savings rate | 42% | 10% | 7.0 |
| **Total** | | | **72.1** |

**Three Timeline Projections**
Three cards side by side:
- 🐻 Bear Case (10th percentile): FIRE in 2033
- 📊 Base Case (50th percentile): FIRE in 2028
- 🐂 Bull Case (90th percentile): FIRE in 2026

Each card shows: date, portfolio value at FI, key assumptions.

**What Moves Your Score**
AI-generated list of the top 3 actions that would most improve the score. Examples:
- "Diversifying 10% of employer stock would raise your score by 4 points"
- "Increasing savings rate to 45% moves base case FIRE date to 2027"

### Score Calculation Logic

```typescript
function calculateFIScore(data: UserFinancialData): number {
  const fundingRatio = data.currentInvestableAssets / data.fireNumber;
  const fundingScore = Math.min(fundingRatio * 40, 40);

  const runwayYears = data.liquidAssets / data.annualSpend;
  const runwayScore = Math.min((runwayYears / 20) * 25, 25);

  const concentrationPct = data.employerStockValue / data.totalNetWorth;
  const concentrationScore = Math.max(15 - (concentrationPct * 30), 0);

  const employmentScore = data.isEmployed ? 10 : 0;

  const savingsRate = (data.annualIncome - data.annualSpend) / data.annualIncome;
  const savingsScore = Math.min((savingsRate / 0.5) * 10, 10);

  return Math.round(
    fundingScore + runwayScore + concentrationScore + employmentScore + savingsScore
  );
}
```

---

## Screen 7 — Monte Carlo Simulator

### Purpose
Show a range of possible futures based on market variability and life events, answering: *how much longer do I need to keep working?*

### Layout

**Fan Chart**
Full-width animated area chart showing portfolio value over 20–30 years.
Five bands rendered:
- 90th percentile (top)
- 75th percentile
- 50th percentile / Median (bold line)
- 25th percentile
- 10th percentile (bottom)

Bands are semi-transparent, darkening toward the median. On hover, a vertical line snaps to year, showing all five values as a tooltip.

A horizontal dashed line marks their **FIRE number**. Intersection points with bands are labeled with dates.

**Outcome Summary Bar**
Below chart:
```
10,000 simulations run

Success Rate     Median at Year 20     Conservative FI     Base Case FI
   87%               $5.2M                 2032               2028
```

**Life Events Timeline**
Horizontal draggable timeline below the chart. Years labeled on the X axis.

Draggable event chips:
- 💼 Quit / Retire
- 🏫 Child College (4yr expense)
- 📉 Layoff
- 🏠 Home Purchase
- 💰 Inheritance / Windfall
- 🏥 Major Expense

Clicking an event chip opens a side panel:

*Example: Quit / Retire*
- When: [year selector]
- Severance: $0 (editable)
- Part-time income after: $0/yr (editable)

*Example: Child College*
- Child name/label
- Start year
- Duration: 4 years
- Annual cost: $55,000 (editable, inflation-adjusted)
- 529 balance to apply: $80,000 (editable)

When events are placed on the timeline, the Monte Carlo re-runs and the fan chart updates with a smooth animation.

**Scenario Manager**
Below the timeline:
- Save current configuration as a named scenario
- Load / compare saved scenarios
- Side-by-side table comparing up to 3 scenarios:

| | Base Case | Layoff 2025 | Early Quit 2027 |
|---|---|---|---|
| Success Rate | 87% | 71% | 79% |
| Median (yr 20) | $5.2M | $3.8M | $4.1M |
| 10th pct (yr 20) | $1.8M | $420K | $890K |
| Base FI Date | 2028 | 2031 | 2028 |

**Variables Panel** (collapsible right sidebar)

```
Portfolio
├── Starting value: [auto from accounts]
├── Annual contribution: $85,000/yr
├── Asset allocation: 80/20
└── Inflation rate: 3.0%

Income  
├── Annual salary (after tax): $280,000
├── RSU vests: [auto from equity screen]
└── Other income: $0

Expenses
├── Current annual spend: $120,000
├── Retirement spend: $96,000
└── Healthcare (pre-Medicare): $24,000/yr

FIRE Parameters
├── FIRE number: $3,000,000
├── Safe withdrawal rate: 4.0%
└── Social Security at 67: $2,800/mo
```

**AI Interpretation Panel**
Below the chart, a card with plain-English analysis of the current simulation:

> *"Your 87% success rate is solid. The primary risk in your 10th percentile scenario is a severe market downturn in the first 3 years of retirement combined with high employer stock concentration. Diversifying 15% of your Amazon position over the next 2 vesting cycles would improve your worst-case outcome by approximately $340,000 at year 20."*

Regenerates automatically when the simulation changes.

### Monte Carlo Engine

Runs entirely client-side using a Web Worker (no server call, no latency, privacy-preserving).

```typescript
// Web Worker: monteCarlo.worker.ts

interface SimulationParams {
  startingPortfolio: number;
  annualContribution: number;
  annualSpend: number;
  retirementSpend: number;
  equityPct: number; // 0-1
  bondPct: number;   // 0-1
  inflationRate: number;
  years: number;
  lifeEvents: LifeEvent[];
  numSimulations: number; // 10000
}

interface SimulationResult {
  percentiles: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  };
  successRate: number; // % that never hit $0
  medianFinalValue: number;
}

function runMonteCarlo(params: SimulationParams): SimulationResult {
  // Historical parameters
  const EQUITY_MEAN = 0.10;
  const EQUITY_STD = 0.17;
  const BOND_MEAN = 0.04;
  const BOND_STD = 0.06;

  const portfolioMean = (params.equityPct * EQUITY_MEAN) + (params.bondPct * BOND_MEAN);
  const portfolioStd = Math.sqrt(
    Math.pow(params.equityPct * EQUITY_STD, 2) +
    Math.pow(params.bondPct * BOND_STD, 2)
  );

  const allRuns: number[][] = [];
  let successes = 0;

  for (let sim = 0; sim < params.numSimulations; sim++) {
    let portfolio = params.startingPortfolio;
    let failed = false;
    const yearlyValues: number[] = [portfolio];
    let annualSpend = params.annualSpend;

    for (let year = 1; year <= params.years; year++) {
      // Random return using Box-Muller transform
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const annualReturn = portfolioMean + portfolioStd * z;

      // Apply life events for this year
      const events = params.lifeEvents.filter(e => e.year === year);
      let yearContribution = params.annualContribution;
      let yearExpense = annualSpend;

      for (const event of events) {
        if (event.type === 'quit') {
          yearContribution = event.partTimeIncome ?? 0;
          yearExpense = params.retirementSpend;
        }
        if (event.type === 'college') {
          yearExpense += event.annualCost - (event.plan529Annual ?? 0);
        }
        if (event.type === 'layoff') {
          yearContribution = event.severance ?? 0;
        }
        if (event.type === 'windfall') {
          yearContribution += event.amount ?? 0;
        }
      }

      portfolio = portfolio * (1 + annualReturn) + yearContribution - yearExpense;
      annualSpend *= (1 + params.inflationRate); // inflation
      yearlyValues.push(Math.max(portfolio, 0));

      if (portfolio <= 0) {
        failed = true;
        // Fill remaining years with 0
        for (let r = year + 1; r <= params.years; r++) yearlyValues.push(0);
        break;
      }
    }

    if (!failed) successes++;
    allRuns.push(yearlyValues);
  }

  // Calculate percentiles for each year
  const percentiles = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  for (let year = 0; year <= params.years; year++) {
    const yearValues = allRuns.map(r => r[year]).sort((a, b) => a - b);
    percentiles.p10.push(yearValues[Math.floor(params.numSimulations * 0.10)]);
    percentiles.p25.push(yearValues[Math.floor(params.numSimulations * 0.25)]);
    percentiles.p50.push(yearValues[Math.floor(params.numSimulations * 0.50)]);
    percentiles.p75.push(yearValues[Math.floor(params.numSimulations * 0.75)]);
    percentiles.p90.push(yearValues[Math.floor(params.numSimulations * 0.90)]);
  }

  return {
    percentiles,
    successRate: successes / params.numSimulations,
    medianFinalValue: percentiles.p50[params.years],
  };
}
```

---

## Data Model (Supabase / Postgres)

```sql
-- Users
users (
  id uuid PRIMARY KEY,
  clerk_id text UNIQUE,
  email text,
  created_at timestamptz
)

-- Financial profile (inputs)
user_profiles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  annual_income numeric,
  annual_spend numeric,
  retirement_spend numeric,
  state_of_residence text,
  filing_status text, -- 'single' | 'mfj'
  fire_number numeric,
  fire_target_year int,
  swr numeric DEFAULT 0.04,
  social_security_estimate numeric,
  updated_at timestamptz
)

-- RSU grants
rsu_grants (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  company_ticker text,
  grant_date date,
  total_shares int,
  vested_shares int,
  cliff_months int DEFAULT 12,
  vest_period_months int DEFAULT 48,
  vest_frequency text DEFAULT 'quarterly', -- 'monthly' | 'quarterly' | 'annual'
  created_at timestamptz
)

-- Monte Carlo saved scenarios
scenarios (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  name text,
  params jsonb, -- SimulationParams serialized
  result_summary jsonb, -- success rate, median, percentiles summary
  created_at timestamptz
)

-- Life events (attached to scenarios or standalone)
life_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  scenario_id uuid REFERENCES scenarios,
  type text, -- 'quit' | 'layoff' | 'college' | 'purchase' | 'windfall'
  year int,
  params jsonb,
  created_at timestamptz
)

-- Cached account data (refreshed from SnapTrade)
account_snapshots (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  snaptrade_account_id text,
  account_type text, -- 'brokerage' | '401k' | 'ira' | 'roth'
  total_value numeric,
  holdings jsonb, -- array of { ticker, shares, price, value, costBasis }
  synced_at timestamptz
)

-- Real estate properties
real_estate_properties (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  address text,
  property_type text, -- 'primary' | 'rental' | 'vacation'
  purchase_price numeric,
  purchase_date date,
  current_value numeric,
  last_value_update timestamptz,
  -- Mortgage fields
  original_loan_amount numeric,
  mortgage_balance numeric,
  mortgage_rate numeric,
  mortgage_term_months int,
  mortgage_start_date date,
  monthly_payment numeric,
  -- Rental fields (nullable for non-rentals)
  monthly_rent numeric,
  include_equity_in_fire boolean DEFAULT false,
  created_at timestamptz,
  updated_at timestamptz
)

-- Property value history (snapshot on each Zillow refresh)
property_value_history (
  id uuid PRIMARY KEY,
  property_id uuid REFERENCES real_estate_properties,
  estimated_value numeric,
  source text, -- 'zillow' | 'manual'
  recorded_at timestamptz
)

-- Net worth daily snapshots (for historical chart)
net_worth_history (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  total_net_worth numeric,
  investment_value numeric,
  retirement_value numeric,
  rsu_value numeric,
  real_estate_equity numeric,
  mortgage_balance numeric,
  cash_other numeric,
  recorded_date date,
  UNIQUE(user_id, recorded_date)
)
```

---

## API Integrations

### SnapTrade
- **Purpose:** Connect brokerage, 401k, IRA accounts
- **Endpoints used:**
  - `POST /snapTrade/login` — register user
  - `GET /accounts` — list connected accounts
  - `GET /accounts/{id}/holdings` — positions and values
  - `GET /accounts/{id}/balances` — cash balances
  - `GET /accounts/{id}/transactions` — transaction history for cost basis
- **Auth:** OAuth 2.0, user connects via SnapTrade Connection Portal embedded in onboarding
- **Docs:** https://docs.snaptrade.com

### Polygon.io
- **Purpose:** Real-time and historical stock prices
- **Endpoints used:**
  - `GET /v2/aggs/ticker/{ticker}/prev` — previous day close
  - `GET /v2/snapshot/locale/us/markets/stocks/tickers` — batch quotes
  - `GET /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}` — historical prices for performance chart
- **Auth:** API key in header
- **Tier:** Starter ($29/mo) sufficient for V1
- **Docs:** https://polygon.io/docs

### Anthropic Claude API
- **Purpose:** AI insights, document parsing, scenario interpretation
- **Model:** `claude-sonnet-4-6`
- **Use cases:**
  1. Grant document parsing: extract vesting schedule from uploaded PDF
  2. Proactive insights: given user financial snapshot, generate 2-3 observations
  3. Monte Carlo interpretation: plain-English summary of simulation results
  4. Natural language scenario input: "what if I get laid off in March" → structured params
- **Implementation:** All calls server-side via Next.js API routes (never expose API key to client)
- **Docs:** https://docs.anthropic.com

### Zillow via RapidAPI
- **Purpose:** On-demand property value estimates
- **Endpoint:** `GET /zestimate` via `zillow-com1.p.rapidapi.com`
- **Auth:** RapidAPI key in header
- **Tier:** Free tier (500 calls/month) sufficient for V1
- **Docs:** https://rapidapi.com/apimaker/api/zillow-com1

### Clerk
- **Purpose:** Authentication and user management
- **Features used:** Email/password, Google SSO, MFA
- **Docs:** https://clerk.com/docs

---

## Environment Variables

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# SnapTrade
SNAPTRADE_CLIENT_ID=
SNAPTRADE_CONSUMER_KEY=

# Polygon
POLYGON_API_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# RapidAPI (Zillow)
RAPIDAPI_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Key Component List

```
/components
├── layout/
│   ├── TopBar.tsx              — FI Score + Net Worth always visible
│   ├── Sidebar.tsx             — Desktop nav
│   └── BottomTabs.tsx          — Mobile nav
├── dashboard/
│   ├── FIScoreCard.tsx         — Animated arc gauge
│   ├── RunwayCard.tsx          — Runway in years
│   ├── FireGapCard.tsx         — Gap to FI number
│   ├── LayoffCard.tsx          — "If laid off tomorrow" checklist
│   └── InsightsFeed.tsx        — AI insight cards
├── networth/
│   ├── NetWorthHero.tsx        — Animated total + sparkline
│   ├── AssetBreakdownBar.tsx   — Horizontal stacked bar
│   ├── NetWorthChart.tsx       — Full historical line chart
│   ├── MilestoneMarkers.tsx    — $1M/$2M/$3M annotations
│   └── AssetClassCards.tsx     — 4 summary cards linking to screens
├── portfolio/
│   ├── AccountBucket.tsx       — Expandable account card
│   ├── HoldingsTable.tsx       — Position list with live prices
│   ├── AllocationChart.tsx     — Dual donut: actual vs recommended
│   ├── GapChart.tsx            — Allocation gap bar chart
│   └── ETFTable.tsx            — Educational ETF comparison
├── realestate/
│   ├── PropertySummaryBar.tsx  — Total value / balance / equity cards
│   ├── PropertyCard.tsx        — Expandable per-property card
│   ├── EquityChart.tsx         — Stacked area: value vs mortgage
│   ├── AmortizationView.tsx    — Schedule + extra payment slider
│   ├── AddPropertyPanel.tsx    — Slide-over form
│   └── RentalMetrics.tsx       — NOI, cap rate, cash-on-cash
├── equity/
│   ├── ConcentrationGauge.tsx  — Arc gauge for employer stock %
│   ├── PriceSlider.tsx         — Stock price scenario slider
│   ├── VestingTimeline.tsx     — 24-month vest calendar
│   └── GrantTable.tsx          — Summary of all grants
├── fire/
│   ├── ScoreHero.tsx           — Large score with progress bar
│   ├── ScoreBreakdown.tsx      — Factor table
│   ├── ProjectionCards.tsx     — Bear / Base / Bull case
│   └── ScoreLevers.tsx         — AI "what moves your score" list
├── montecarlo/
│   ├── FanChart.tsx            — Multi-band area chart (Recharts)
│   ├── OutcomeSummary.tsx      — Success rate, median, dates
│   ├── EventTimeline.tsx       — Draggable life events
│   ├── EventPanel.tsx          — Side panel for event config
│   ├── ScenarioManager.tsx     — Save/load/compare scenarios
│   ├── VariablesPanel.tsx      — Collapsible input sidebar
│   └── AIInterpretation.tsx    — Plain-English summary
└── shared/
    ├── AnimatedNumber.tsx      — Count-up animation
    ├── Tooltip.tsx
    ├── Card.tsx
    └── Badge.tsx               — Green/Amber/Red status
```

---

## V1 Scope Boundaries

**In V1:**
- All 7 screens described above
- SnapTrade account connection (read-only)
- RSU grant input and vesting schedule
- Real estate property tracking with mortgage amortization
- Zillow Zestimate integration (on-demand)
- Net worth tracking with historical chart
- Monte Carlo engine (client-side Web Worker)
- FireRunway calculation
- Recommended allocation (rule-based, not personalized advice)
- AI insights via Claude API
- Responsive: desktop + mobile
- Dark mode (default and only theme in V1)

**Explicitly Out of V1:**
- Trading / executing transactions
- Tax-loss harvesting execution
- Budgeting / transaction categorization
- Social features
- Advisor integrations
- Mobile native app (web-responsive only)
- Light mode
- Multi-user / household view

---

## Legal Disclaimer (Required on Every Screen)

```
FireRunway provides financial information for educational purposes only. 
Nothing on this platform constitutes personalized investment advice. 
ETF information shown is educational and not a recommendation to buy or sell 
any security. Please consult a licensed financial advisor for personalized advice.
```

Display as a subtle footer on every page. Also shown as a modal on first use.

---

## Deployment Strategy

Two-stage deployment: local homelab for development and testing, VPS for production when ready to share or go live. The app is identical in both environments — only the environment variables and infrastructure change.

---

### Stage 1 — Homelab Development

Run everything locally on a Proxmox VM or directly on your Mac M4. No cloud infrastructure needed during development except Supabase (keep it cloud so the database is accessible regardless of which machine you're developing on).

**Recommended local VM spec (Proxmox):**
- Ubuntu 24.04 LTS
- 2 vCPU, 4GB RAM, 40GB disk
- Bridged networking so it's accessible from other machines on your LAN

**Local setup:**

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Clone and install
git clone <your-repo>
cd firerunway
npm install

# Create .env.local with all keys (see Environment Variables section)
cp .env.example .env.local

# Run dev server
npm run dev
# App available at http://localhost:3000
# Or on your LAN at http://<vm-ip>:3000
```

**Local cron (for net worth snapshots during dev):**
```bash
# Use system cron — no Vercel Pro needed
crontab -e
# Add:
0 23 * * * curl -s -X POST http://localhost:3000/api/cron/snapshot \
  -H "Authorization: Bearer $CRON_SECRET"
```

**SnapTrade in dev mode:**
SnapTrade provides a sandbox environment with test brokerages and mock data. Use this during homelab development — no real account connections needed until you move to production. Set `SNAPTRADE_ENV=sandbox` in your `.env.local`.

**Accessing from other devices on your LAN:**
Since your VM has a local IP (e.g. `192.168.1.x`), you can open the app on any device on your network during development — useful for testing mobile layout on your phone without deploying anywhere.

---

### Stage 2 — VPS Production

When the POC is ready to share or test with real accounts, move to a VPS. The codebase doesn't change — only the environment variables and the server running it.

**Recommended VPS:**
- **Hetzner CX22** — 2 vCPU, 4GB RAM, 40GB SSD, €3.79/mo (~$4.50)
- Hetzner has excellent price/performance and European data centers (good for GDPR if you ever expand)
- Alternatives: Contabo ($6/mo), DigitalOcean ($6/mo)

**VPS initial setup (Ubuntu 24.04):**

```bash
# Update and install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx git

# Install PM2 globally
sudo npm install -g pm2

# Create app user (don't run as root)
sudo useradd -m -s /bin/bash firerunway
sudo su - firerunway

# Clone repo
git clone <your-repo>
cd firerunway
npm install
npm run build
```

**PM2 process management:**

```bash
# Start the app
pm2 start npm --name "firerunway" -- start

# Auto-restart on server reboot
pm2 startup
pm2 save

# Useful commands
pm2 status          # check running processes
pm2 logs firerunway  # tail logs
pm2 restart firerunway
```

**Nginx reverse proxy config:**

```nginx
# /etc/nginx/sites-available/firerunway
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/firerunway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL with Let's Encrypt (free)
sudo certbot --nginx -d yourdomain.com
# Certbot auto-renews — no maintenance needed
```

**Production cron jobs:**

```bash
# System crontab for net worth daily snapshot
crontab -e
# Add:
0 23 * * * curl -s -X POST https://yourdomain.com/api/cron/snapshot \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Simple deploy script (run on VPS after pushing to git):**

```bash
#!/bin/bash
# /home/firerunway/deploy.sh
set -e

echo "Pulling latest..."
cd /home/firerunway/firerunway
git pull origin main

echo "Installing dependencies..."
npm install

echo "Building..."
npm run build

echo "Restarting..."
pm2 restart firerunway

echo "Done. $(date)"
```

```bash
chmod +x deploy.sh
# Deploy anytime with: ./deploy.sh
```

**Optional — auto-deploy on git push via GitHub Actions:**

```yaml
# .github/workflows/deploy.yml
name: Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: firerunway
          key: ${{ secrets.VPS_SSH_KEY }}
          script: /home/firerunway/deploy.sh
```

Add `VPS_HOST` and `VPS_SSH_KEY` to your GitHub repo secrets. Every push to main auto-deploys.

---

### Environment Variables — Both Stages

Create `.env.local` for homelab, `.env.production` for VPS. The variable names are identical — only the values differ (sandbox vs production API keys).

```bash
# App
NODE_ENV=development          # change to 'production' on VPS
CRON_SECRET=your-random-secret-here  # shared between app and cron caller

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# SnapTrade
SNAPTRADE_CLIENT_ID=
SNAPTRADE_CONSUMER_KEY=
SNAPTRADE_ENV=sandbox         # change to 'production' on VPS

# Polygon (free tier — same key both environments)
POLYGON_API_KEY=

# AI — Gemini default, Claude fallback
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
DEFAULT_AI_PROVIDER=gemini    # 'gemini' | 'claude'

# RapidAPI (Zillow)
RAPIDAPI_KEY=

# Supabase (same instance both environments for POC)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

### POC Cost Summary

| Service | Homelab | VPS Production |
|---|---|---|
| Compute | $0 (existing hardware) | ~$4.50/mo (Hetzner) |
| Supabase | $0 (free tier) | $0 (free tier) |
| Clerk | $0 (free tier) | $0 (free tier) |
| SnapTrade | $0 (sandbox) | $0 (dev tier) |
| Polygon.io | $0 (free tier) | $0 (free tier) |
| Gemini Flash | $0 (free tier) | $0 (free tier) |
| Claude API | ~$1–3 (doc parsing) | ~$1–3 |
| Zillow RapidAPI | $0 (free tier) | $0 (free tier) |
| Domain | — | ~$1/mo (Namecheap) |
| **Total** | **~$0/mo** | **~$6–8/mo** |

---

## Getting Started (For Coding Agent)

1. Initialize Next.js 14 app with TypeScript and Tailwind
2. Install Clerk, configure auth middleware
3. Set up Supabase schema using SQL above
4. Configure `.env.local` with all API keys (sandbox/free tiers)
5. Build the Monte Carlo Web Worker first — it's the engine everything depends on
6. Build screens in order: Dashboard → Net Worth → Portfolio → Real Estate → Equity → FIRE Score → Monte Carlo
7. Add Polygon price feeds (free tier, previous day close)
8. Add Zillow RapidAPI integration for property estimates
9. Add system cron for daily net worth snapshot
10. Add Gemini Flash as default AI provider, Claude as fallback
11. Polish animations last
12. When ready for VPS: provision Hetzner, run setup above, switch env vars to production

---

*FireRunway V1 Spec — Last updated February 2026*
