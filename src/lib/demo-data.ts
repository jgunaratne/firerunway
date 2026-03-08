/**
 * Demo mode — hardcoded data for the "View Demo" experience.
 *
 * When demo mode is active, data providers serve this data
 * instead of making API calls.  No Firebase auth required.
 */

const DEMO_KEY = 'firerunway_demo_mode';

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === '1';
  } catch {
    return false;
  }
}

export function enableDemoMode(): void {
  try {
    localStorage.setItem(DEMO_KEY, '1');
  } catch { /* SSR guard */ }
}

export function disableDemoMode(): void {
  try {
    localStorage.removeItem(DEMO_KEY);
    localStorage.removeItem('user_data_cache');
    localStorage.removeItem('snaptrade_brokerage_data');
  } catch { /* SSR guard */ }
}

// ─── Profile ────────────────────────────────────────────────────────

export const DEMO_PROFILE = {
  annual_income: 380000,
  annual_spend: 120000,
  retirement_spend: 96000,
  state_of_residence: 'WA',
  filing_status: 'mfj',
  fire_number: 3000000,
  fire_target_year: 2030,
  swr: 4,
};

// ─── RSU Grants ─────────────────────────────────────────────────────

export const DEMO_RSU_GRANTS = [
  {
    id: 'demo-rsu-1',
    company_ticker: 'AMZN',
    grant_date: '2022-03-15',
    total_shares: 400,
    vested_shares: 300,
    cliff_months: 12,
    vest_period_months: 48,
    vest_frequency: 'quarterly',
  },
  {
    id: 'demo-rsu-2',
    company_ticker: 'AMZN',
    grant_date: '2024-03-15',
    total_shares: 200,
    vested_shares: 50,
    cliff_months: 12,
    vest_period_months: 48,
    vest_frequency: 'quarterly',
  },
];

// ─── Real Estate ────────────────────────────────────────────────────

export const DEMO_REAL_ESTATE = [
  {
    id: 'demo-re-1',
    address: '1234 Evergreen Terrace, Bellevue, WA',
    property_type: 'primary',
    purchase_price: 850000,
    purchase_date: '2021-06-01',
    current_value: 975000,
    original_loan_amount: 680000,
    mortgage_balance: 618000,
    mortgage_rate: 3.25,
    mortgage_term_months: 360,
    mortgage_start_date: '2021-06-01',
    monthly_payment: 2960,
    monthly_rent: null,
    include_equity_in_fire: true,
  },
];

// ─── Account Snapshots (statements) ─────────────────────────────────

export const DEMO_ACCOUNTS = [
  {
    id: 'demo-snap-1',
    account_type: 'brokerage',
    total_value: 892000,
    holdings: [
      { ticker: 'VTI', shares: 1200, price: 265, value: 318000 },
      { ticker: 'VXUS', shares: 800, price: 62, value: 49600 },
      { ticker: 'AMZN', shares: 350, price: 190, value: 66500 },
    ],
  },
];

// ─── Brokerage Accounts (SnapTrade-style) ───────────────────────────

export const DEMO_BROKERAGE_ACCOUNTS = [
  {
    id: 'demo-acct-1',
    authorization_id: 'demo-auth-1',
    name: 'Individual Brokerage',
    number: '****4521',
    institution_name: 'Charles Schwab',
    type: 'MARGIN',
    balance: 892000,
  },
  {
    id: 'demo-acct-2',
    authorization_id: 'demo-auth-2',
    name: '401(k)',
    number: '****7829',
    institution_name: 'Fidelity',
    type: 'RETIREMENT',
    balance: 485000,
  },
];

// ─── Positions ──────────────────────────────────────────────────────

export const DEMO_POSITIONS = [
  { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', shares: 1200, price: 265.40, value: 318480, accountId: 'demo-acct-1', accountName: 'Individual Brokerage', accountType: 'MARGIN', institutionName: 'Charles Schwab' },
  { ticker: 'VXUS', name: 'Vanguard Total Intl Stock ETF', shares: 800, price: 62.15, value: 49720, accountId: 'demo-acct-1', accountName: 'Individual Brokerage', accountType: 'MARGIN', institutionName: 'Charles Schwab' },
  { ticker: 'BND', name: 'Vanguard Total Bond Market ETF', shares: 500, price: 72.80, value: 36400, accountId: 'demo-acct-1', accountName: 'Individual Brokerage', accountType: 'MARGIN', institutionName: 'Charles Schwab' },
  { ticker: 'AMZN', name: 'Amazon.com Inc', shares: 350, price: 190.25, value: 66588, accountId: 'demo-acct-1', accountName: 'Individual Brokerage', accountType: 'MARGIN', institutionName: 'Charles Schwab' },
  { ticker: 'AAPL', name: 'Apple Inc', shares: 400, price: 178.50, value: 71400, accountId: 'demo-acct-1', accountName: 'Individual Brokerage', accountType: 'MARGIN', institutionName: 'Charles Schwab' },
  { ticker: 'MSFT', name: 'Microsoft Corp', shares: 200, price: 415.60, value: 83120, accountId: 'demo-acct-1', accountName: 'Individual Brokerage', accountType: 'MARGIN', institutionName: 'Charles Schwab' },
  { ticker: 'SCHD', name: 'Schwab US Dividend Equity ETF', shares: 600, price: 81.20, value: 48720, accountId: 'demo-acct-1', accountName: 'Individual Brokerage', accountType: 'MARGIN', institutionName: 'Charles Schwab' },
  { ticker: 'QQQ', name: 'Invesco QQQ Trust', shares: 250, price: 470.30, value: 117575, accountId: 'demo-acct-1', accountName: 'Individual Brokerage', accountType: 'MARGIN', institutionName: 'Charles Schwab' },
  { ticker: 'FXAIX', name: 'Fidelity 500 Index Fund', shares: 850, price: 198.40, value: 168640, accountId: 'demo-acct-2', accountName: '401(k)', accountType: 'RETIREMENT', institutionName: 'Fidelity' },
  { ticker: 'FXNAX', name: 'Fidelity US Bond Index Fund', shares: 1200, price: 10.45, value: 12540, accountId: 'demo-acct-2', accountName: '401(k)', accountType: 'RETIREMENT', institutionName: 'Fidelity' },
  { ticker: 'FSPSX', name: 'Fidelity Intl Index Fund', shares: 2500, price: 48.90, value: 122250, accountId: 'demo-acct-2', accountName: '401(k)', accountType: 'RETIREMENT', institutionName: 'Fidelity' },
  { ticker: 'FSMEX', name: 'Fidelity Medical Tech Fund', shares: 300, price: 60.50, value: 18150, accountId: 'demo-acct-2', accountName: '401(k)', accountType: 'RETIREMENT', institutionName: 'Fidelity' },
];

// ─── Plaid Accounts ─────────────────────────────────────────────────

export const DEMO_PLAID_ACCOUNTS = [
  { id: 'demo-plaid-1', itemId: 'demo-item-1', name: 'Checking', officialName: 'Chase Total Checking', type: 'depository', subtype: 'checking', mask: '6142', currentBalance: 24850, availableBalance: 24850, limit: null, institutionName: 'Chase' },
  { id: 'demo-plaid-2', itemId: 'demo-item-1', name: 'Savings', officialName: 'Chase Savings', type: 'depository', subtype: 'savings', mask: '9031', currentBalance: 65000, availableBalance: 65000, limit: null, institutionName: 'Chase' },
  { id: 'demo-plaid-3', itemId: 'demo-item-2', name: 'Platinum Card', officialName: 'Amex Platinum', type: 'credit', subtype: 'credit card', mask: '1005', currentBalance: 4280, availableBalance: null, limit: 30000, institutionName: 'American Express' },
];

// ─── Net Worth History ──────────────────────────────────────────────

export const DEMO_NET_WORTH_HISTORY = [
  { recorded_date: '2025-10-01', total_net_worth: 2680000, investment_value: 1190000, retirement_value: 420000, rsu_value: 58000, real_estate_equity: 312000 },
  { recorded_date: '2025-11-01', total_net_worth: 2750000, investment_value: 1220000, retirement_value: 435000, rsu_value: 61000, real_estate_equity: 334000 },
  { recorded_date: '2025-12-01', total_net_worth: 2810000, investment_value: 1255000, retirement_value: 448000, rsu_value: 63000, real_estate_equity: 344000 },
  { recorded_date: '2026-01-01', total_net_worth: 2870000, investment_value: 1290000, retirement_value: 460000, rsu_value: 64000, real_estate_equity: 356000 },
  { recorded_date: '2026-02-01', total_net_worth: 2940000, investment_value: 1335000, retirement_value: 472000, rsu_value: 66000, real_estate_equity: 357000 },
  { recorded_date: '2026-03-01', total_net_worth: 3020000, investment_value: 1377000, retirement_value: 485000, rsu_value: 66500, real_estate_equity: 357000 },
];

// ─── Income & Tax Records ───────────────────────────────────────────

export const DEMO_INCOME_TAX_RECORDS = [
  {
    id: 'demo-tax-1',
    tax_year: 2024,
    filename: 'W2_2024_Amazon.pdf',
    document_type: 'W-2',
    employer: 'Amazon.com Services LLC',
    income_breakdown: { wages: 185000, rsu_income: 142000, bonus: 38000, other: 15000 },
    total_income: 380000,
    tax_breakdown: { federal: 72500, state: 0, social_security: 10453, medicare: 5510 },
    total_tax: 88463,
    effective_tax_rate: 23.3,
  },
  {
    id: 'demo-tax-2',
    tax_year: 2023,
    filename: 'W2_2023_Amazon.pdf',
    document_type: 'W-2',
    employer: 'Amazon.com Services LLC',
    income_breakdown: { wages: 175000, rsu_income: 118000, bonus: 35000, other: 12000 },
    total_income: 340000,
    tax_breakdown: { federal: 62800, state: 0, social_security: 9932, medicare: 4930 },
    total_tax: 77662,
    effective_tax_rate: 22.8,
  },
];

// ─── Computed Totals ────────────────────────────────────────────────

export const DEMO_TOTAL_INVESTMENT = DEMO_POSITIONS.reduce((sum, p) => sum + p.value, 0);
