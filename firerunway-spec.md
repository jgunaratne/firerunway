# FireRunway — Product Specification

## Overview

FireRunway is a financial independence dashboard for senior tech workers. It connects to brokerage and bank accounts, models RSU/equity compensation, calculates a Financial Independence score, and runs Monte Carlo simulations to answer one core question: **how much longer do I need to keep working?**

Live at: [firerunway.com](https://firerunway.com)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + vanilla CSS design system |
| Charts | Recharts |
| Auth | Firebase Authentication (Google sign-in) |
| Account Aggregation | SnapTrade API (brokerage), Plaid (bank accounts) |
| Market Data | Yahoo Finance / Polygon.io fallback |
| AI | Google Gemini API (`gemini-2.0-flash`) |
| PDF Parsing | Gemini multimodal (statement + tax doc extraction) |
| Database | Supabase (Postgres) |
| Hosting | VPS (Ubuntu) with PM2 + Nginx + Let's Encrypt |

---

## Design Direction

**Aesthetic:** Premium dark-mode developer tool with light mode support. Think Linear meets Bloomberg terminal. Sharp, data-dense, confident.

**Themes:** Dark (default) and Light mode, toggled via TopBar. CSS custom properties power all theming — no hardcoded colors.

**Key design tokens:**
```css
--bg-primary, --bg-surface, --bg-elevated
--border, --text-primary, --text-secondary
--accent: #6366f1 (indigo)
--accent-green: #10b981
--accent-amber: #f59e0b
--accent-red: #ef4444
```

**Typography:** Inter (Google Fonts) for all UI text. Numbers use monospaced rendering for alignment.

**Layout:**
- Max width 1400px, centered
- Persistent top bar with FI Score, Net Worth, theme toggle, user menu
- Left sidebar nav on desktop, bottom tab bar on mobile
- Cards use `background: var(--bg-elevated)`, `border: 1px solid var(--border)`

---

## Authentication

Firebase Authentication with Google as the sole sign-in provider.

**Client-side:** `AuthProvider` context wraps the app. Exposes `user`, `loading`, and `getIdToken()`.

**Server-side:** API routes call `extractUserId(request)` which verifies the Firebase ID token via `firebase-admin` and resolves the Firebase UID to a Supabase `users.id`.

**Auth guard:** Unauthenticated users are redirected to the landing page (`/`). Public paths: `/`, `/sign-in`, `/sign-up`.

**Landing page:** Shows hero section, feature overview, and Google sign-in CTA for unauthenticated users. Authenticated users are auto-redirected to `/dashboard`.

---

## Navigation Structure

```
Top Bar (always visible)
├── Logo / Brand
├── FI Score (animated gauge, e.g. "72")
├── Net Worth (e.g. "$3.2M")
├── Theme toggle (sun/moon)
├── Refresh button
└── User avatar → Sign out

Left Sidebar (desktop) / Bottom Tabs (mobile)
├── Dashboard
├── Net Worth
├── Portfolio
├── Real Estate
├── Equity / RSUs
├── Statements
├── Income & Tax
├── Spending Plan
├── Monte Carlo
└── Settings / Onboarding
```

---

## Screens

### Landing Page (`/`)
- Hero with gradient glow effect
- "Financial Independence Platform" badge
- Feature grid: Net Worth Tracking, Portfolio Analysis, Monte Carlo, FIRE Score, AI Analysis, Statement Upload
- Google sign-in CTA
- Redirects to `/dashboard` when authenticated

### Dashboard (`/dashboard`)
- **Hero row:** FI Score gauge, Runway in years, FIRE Gap
- **"If Laid Off Tomorrow" card:** Mortgage coverage, emergency fund months, unvested RSUs at risk
- **AI Insights feed:** 3 dynamic insight cards based on live data
- **Quick links:** Portfolio, Monte Carlo, Spending Plan

### Net Worth (`/net-worth`)
- **Hero:** Total net worth with animated counter
- **Asset breakdown:** Investment Accounts, Real Estate Equity, RSU Value with percentages
- **Historical chart:** Net worth over time with time range toggles (3M / 6M / 1Y / All)
- **Milestone markers:** $1M, $2M, $3M, $4M lines on chart
- **AI analysis:** Gemini-powered insights on net worth trajectory

### Portfolio (`/portfolio`)
- **SnapTrade-connected accounts** with live holdings data
- **Plaid-connected bank accounts** with balances
- **Three tabs:** Holdings, Allocation (donut charts), Performance
- **Account management:** Connect new accounts via SnapTrade/Plaid

### Real Estate (`/real-estate`)
- **Summary bar:** Total property value, mortgage balance, equity
- **Property cards:** Per-property details with mortgage info
- **Equity chart:** Value vs mortgage over time
- **Rental metrics:** NOI, cap rate, cash-on-cash for rental properties

### Equity / RSUs (`/equity`)
- **Concentration gauge:** Employer stock as % of net worth
- **Stock price scenario slider:** -50% to +50% with live value updates
- **Vesting timeline:** Next 24 months of vest events
- **Grant summary table:** All grants with vested/unvested breakdown

### Statements (`/statements`)
- **PDF upload:** Drag-and-drop brokerage statement PDFs
- **AI extraction:** Gemini parses holdings, values, and account details from PDFs
- **Statement list:** All uploaded statements with extraction confidence scores
- **Reprocessing:** Re-parse statements with updated AI logic

### Income & Tax (`/income-tax`)
- **W-2/1099 upload:** AI extracts income, tax withholding, employer info
- **Tax year grouping:** Organized by tax year
- **Income breakdown:** Salary, bonus, RSU income, other
- **Tax analysis:** Effective tax rate, federal vs state breakdown

### Spending Plan (`/spending-plan`)
- **Monthly budget view:** Income vs expenses
- **Net worth integration:** Bank balances, credit card debt included
- **Savings rate calculation**

### Monte Carlo (`/monte-carlo`)
- **Fan chart:** 5-band area chart (P10/P25/P50/P75/P90) over 30 years
- **10,000 simulations** run client-side
- **Outcome summary:** Success rate, median at year 20, FI dates
- **Variables panel:** Starting portfolio, contributions, spend, allocation, inflation
- **AI interpretation:** Gemini-powered plain-English analysis of results

### FIRE Score (`/fire-score`)
- **Score hero:** Large animated score (0-100) with progress bar
- **Score breakdown table:** Funding ratio, runway, concentration, employment, savings rate
- **Three projections:** Bear / Base / Bull case FI dates

### Onboarding (`/onboarding`)
- **Multi-step wizard:** Accounts → RSUs → Real Estate → Your Numbers → First Look
- **SnapTrade + Plaid connection** embedded in flow
- **RSU grant input** with vesting schedule
- **Real estate** property entry
- **Financial profile** (income, spend, FIRE number)

---

## AI Integration (Gemini)

All AI features use Google Gemini (`gemini-2.0-flash`):

- **Statement parsing:** Multimodal PDF → structured holdings/account data
- **Tax document parsing:** W-2/1099 extraction
- **Net worth analysis:** Trend insights and recommendations
- **Portfolio analysis:** Allocation review, concentration warnings
- **Monte Carlo interpretation:** Plain-English simulation summaries
- **Real estate analysis:** Property-level insights
- **ChatRail:** Persistent AI chat sidebar on every page, context-aware

The ChatRail sends the current page's data snapshot to Gemini for context-aware responses. Supports persona modes (Ramit / Ramsey).

---

## Data Model (Supabase)

```sql
users (
  id uuid PRIMARY KEY,
  firebase_uid text UNIQUE,
  snaptrade_user_id text,      -- original registration ID for SnapTrade API
  email text,
  created_at timestamptz
)

-- Financial profile
user_profiles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  annual_income numeric,
  annual_spend numeric,
  retirement_spend numeric,
  state_of_residence text,
  filing_status text,
  fire_number numeric,
  fire_target_year int,
  swr numeric DEFAULT 0.04
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
  vest_frequency text DEFAULT 'quarterly'
)

-- Real estate properties
real_estate_properties (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  address text,
  property_type text,
  purchase_price numeric,
  current_value numeric,
  mortgage_balance numeric,
  monthly_payment numeric,
  mortgage_rate numeric,
  monthly_rent numeric
)

-- Brokerage statement uploads
statements (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  filename text,
  broker text,
  account_number text,
  account_type text,
  statement_date date,
  total_value numeric,
  cash_balance numeric,
  extraction_confidence text,
  extraction_notes text,
  pdf_storage_path text,
  uploaded_at timestamptz
)

-- Parsed holdings from statements
holdings (
  id uuid PRIMARY KEY,
  statement_id uuid REFERENCES statements ON DELETE CASCADE,
  symbol text,
  name text,
  asset_class text,
  quantity numeric,
  price numeric,
  market_value numeric
)

-- SnapTrade account snapshots
account_snapshots (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  snaptrade_account_id text,
  account_type text,
  total_value numeric,
  holdings jsonb,
  synced_at timestamptz
)

-- AI analysis cache
analyses (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  type text,
  content text,
  context_json jsonb,
  created_at timestamptz,
  UNIQUE(user_id, type)
)

-- Income / tax documents
income_tax (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  tax_year int,
  filename text,
  document_type text,
  total_income numeric,
  total_tax numeric,
  effective_tax_rate numeric
)

-- Monte Carlo saved scenarios
scenarios (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  name text,
  params jsonb,
  result_summary jsonb,
  created_at timestamptz
)

-- Net worth snapshots
net_worth_history (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users,
  total_net_worth numeric,
  recorded_date date,
  UNIQUE(user_id, recorded_date)
)
```

---

## API Integrations

### Firebase Authentication
- **Purpose:** User authentication via Google sign-in
- **Client SDK:** `firebase/auth` for sign-in flows
- **Admin SDK:** `firebase-admin` for server-side token verification
- **Docs:** https://firebase.google.com/docs/auth

### SnapTrade
- **Purpose:** Connect brokerage and retirement accounts (read-only)
- **Features:** Account listing, holdings, balances
- **Auth:** Users registered with `snaptrade_user_id` (original Clerk ID, preserved for compatibility)
- **Docs:** https://docs.snaptrade.com

### Plaid
- **Purpose:** Connect bank accounts (checking, savings, credit cards)
- **Features:** Account balances, transaction data
- **Docs:** https://plaid.com/docs

### Google Gemini
- **Purpose:** AI analysis, PDF parsing, chat assistant
- **Model:** `gemini-2.0-flash`
- **Use cases:** Statement parsing, tax doc extraction, financial insights, Monte Carlo interpretation, ChatRail
- **Docs:** https://ai.google.dev/docs

### Supabase
- **Purpose:** Postgres database + file storage (PDF uploads)
- **Storage bucket:** `statement-pdfs` for uploaded documents
- **Docs:** https://supabase.com/docs

---

## Environment Variables

```bash
# Firebase Auth (client-side — baked into build)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-side)
FIREBASE_SERVICE_ACCOUNT=        # JSON service account key

# SnapTrade
SNAPTRADE_CLIENT_ID=
SNAPTRADE_CONSUMER_KEY=

# Plaid
PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=                       # sandbox | production

# Google Gemini
GEMINI_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

> **Note:** `NEXT_PUBLIC_` variables are embedded into the client bundle at build time. Changing them requires `npm run build` + PM2 restart.

---

## Deployment

### Production (VPS)

The app runs on a VPS with:
- **Node.js** + **PM2** process manager
- **Nginx** reverse proxy with SSL (Let's Encrypt)
- **Domain:** firerunway.com

**Deploy workflow:**
```bash
git pull origin main
npm install
npm run build
pm2 restart firerunway
```

---

## Key Hooks & Shared Logic

| Hook / Utility | Purpose |
|---|---|
| `useNetWorth()` | Single source of truth for net worth calculation across all pages |
| `useStockPrice(ticker)` | Fetches and caches current stock price |
| `useAuth()` | Firebase auth context (user, loading, getIdToken) |
| `useUserData()` | All user data from Supabase (profile, RSUs, real estate, etc.) |
| `useBrokerageData()` | SnapTrade portfolio data with caching |
| `calculateFIScore()` | FIRE score calculation (funding ratio, runway, concentration, savings) |
| `extractUserId(request)` | Server-side: verify Firebase token → resolve Supabase user ID |

---

## Legal Disclaimer

```
FireRunway provides financial information for educational purposes only.
Nothing on this platform constitutes personalized investment advice.
Please consult a licensed financial advisor for personalized advice.
```

---

*FireRunway Spec — Last updated March 2026*
