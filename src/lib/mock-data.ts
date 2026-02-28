// Mock data for FireRunway — realistic financial data for a senior tech worker

export const mockUser = {
  name: 'Alex Chen',
  email: 'alex.chen@example.com',
  age: 34,
  stateOfResidence: 'WA',
  filingStatus: 'mfj' as const,
  isEmployed: true,
};

export const mockProfile = {
  annualIncome: 380000,
  annualSpend: 120000,
  retirementSpend: 96000,
  fireNumber: 3000000,
  fireTargetYear: 2028,
  swr: 0.04,
  socialSecurityEstimate: 2800,
};

export const mockRSUGrants = [
  {
    id: '1',
    companyTicker: 'AMZN',
    companyName: 'Amazon',
    grantDate: '2022-01-15',
    totalShares: 1000,
    vestedShares: 750,
    cliffMonths: 12,
    vestPeriodMonths: 48,
    vestFrequency: 'quarterly' as const,
  },
  {
    id: '2',
    companyTicker: 'AMZN',
    companyName: 'Amazon',
    grantDate: '2024-01-15',
    totalShares: 500,
    vestedShares: 125,
    cliffMonths: 12,
    vestPeriodMonths: 48,
    vestFrequency: 'quarterly' as const,
  },
];

export const mockStockPrice = {
  AMZN: 190.50,
};

export const mockAccounts = {
  brokerage: {
    type: 'brokerage' as const,
    name: 'Schwab Individual Brokerage',
    totalValue: 2100000,
    holdings: [
      { ticker: 'VTI', name: 'Vanguard Total Stock Market', shares: 4200, price: 275.40, value: 1156680, costBasis: 890000, change1d: 1.2 },
      { ticker: 'VXUS', name: 'Vanguard Total International', shares: 2800, price: 62.30, value: 174440, costBasis: 155000, change1d: -0.3 },
      { ticker: 'AMZN', name: 'Amazon.com', shares: 280, price: 190.50, value: 53340, costBasis: 42000, change1d: 2.1 },
      { ticker: 'BND', name: 'Vanguard Total Bond Market', shares: 1200, price: 71.80, value: 86160, costBasis: 88000, change1d: 0.1 },
      { ticker: 'VOO', name: 'Vanguard S&P 500', shares: 1100, price: 512.20, value: 563420, costBasis: 410000, change1d: 0.9 },
      { ticker: 'CASH', name: 'Cash & Equivalents', shares: 1, price: 65960, value: 65960, costBasis: 65960, change1d: 0 },
    ],
  },
  retirement401k: {
    type: '401k' as const,
    name: 'Fidelity 401(k)',
    totalValue: 680000,
    contributionYTD: 18500,
    contributionLimit: 23000,
    holdings: [
      { ticker: 'FXAIX', name: 'Fidelity 500 Index', shares: 2800, price: 198.60, value: 556080, costBasis: 420000, change1d: 0.8 },
      { ticker: 'FXNAX', name: 'Fidelity US Bond Index', shares: 1100, price: 10.50, value: 11550, costBasis: 12000, change1d: 0.0 },
      { ticker: 'FSPSX', name: 'Fidelity Intl Index', shares: 2200, price: 51.10, value: 112370, costBasis: 98000, change1d: -0.4 },
    ],
  },
  rothIRA: {
    type: 'roth' as const,
    name: 'Vanguard Roth IRA',
    totalValue: 300000,
    holdings: [
      { ticker: 'VTI', name: 'Vanguard Total Stock Market', shares: 820, price: 275.40, value: 225828, costBasis: 180000, change1d: 1.2 },
      { ticker: 'VXUS', name: 'Vanguard Total International', shares: 1190, price: 62.30, value: 74137, costBasis: 62000, change1d: -0.3 },
    ],
  },
};

export const mockRealEstate = [
  {
    id: '1',
    address: '123 Main St, Seattle, WA 98101',
    propertyType: 'primary' as const,
    purchasePrice: 980000,
    purchaseDate: '2019-06-15',
    currentValue: 1400000,
    lastValueUpdate: '2026-01-15',
    originalLoanAmount: 784000,
    mortgageBalance: 620000,
    mortgageRate: 3.25,
    mortgageTermMonths: 360,
    mortgageStartDate: '2019-07-01',
    monthlyPayment: 3840,
    monthlyRent: null,
    includeEquityInFire: false,
  },
  {
    id: '2',
    address: '456 Pine Ave, Bellevue, WA 98004',
    propertyType: 'rental' as const,
    purchasePrice: 650000,
    purchaseDate: '2021-03-01',
    currentValue: 800000,
    lastValueUpdate: '2026-01-20',
    originalLoanAmount: 520000,
    mortgageBalance: 460000,
    mortgageRate: 4.125,
    mortgageTermMonths: 360,
    mortgageStartDate: '2021-04-01',
    monthlyPayment: 2520,
    monthlyRent: 3200,
    includeEquityInFire: false,
  },
];

// Generate 3 years of net worth history data
function generateNetWorthHistory() {
  const data = [];
  const startDate = new Date('2023-03-01');
  const endDate = new Date('2026-02-27');
  let investment = 1400000;
  let retirement = 480000;
  let rsu = 150000;
  let realEstateEquity = 600000;
  let cash = 80000;
  let mortgageBalance = 1200000;

  const current = new Date(startDate);
  while (current <= endDate) {
    // Add some realistic monthly growth with noise
    const monthlyMarketReturn = 0.008 + (Math.random() - 0.5) * 0.04;
    const monthlySavings = 7000;

    investment *= (1 + monthlyMarketReturn);
    investment += monthlySavings;
    retirement *= (1 + monthlyMarketReturn * 0.9);
    retirement += 1900;
    rsu *= (1 + monthlyMarketReturn * 1.2);
    realEstateEquity += 3000 + Math.random() * 2000;
    cash += (Math.random() - 0.3) * 5000;
    mortgageBalance -= 2800;

    const totalNetWorth = investment + retirement + rsu + realEstateEquity + cash - mortgageBalance;

    data.push({
      date: current.toISOString().split('T')[0],
      totalNetWorth: Math.round(totalNetWorth),
      investmentValue: Math.round(investment),
      retirementValue: Math.round(retirement),
      rsuValue: Math.round(rsu),
      realEstateEquity: Math.round(realEstateEquity),
      cashOther: Math.round(cash),
      mortgageBalance: Math.round(mortgageBalance),
    });

    current.setDate(current.getDate() + 7); // Weekly snapshots
  }
  return data;
}

export const mockNetWorthHistory = generateNetWorthHistory();

// Current totals derived from accounts
export const mockTotals = {
  investmentAccounts: 2100000,
  retirementAccounts: 980000,
  realEstateEquity: 1340000,
  rsuValueVested: 280000,
  cashOther: 120000,
  totalAssets: 4820000,
  totalMortgage: 860000, // mortgage only for liabilities section
  netWorth: 3960000,
};

// Current allocation
export const mockAllocation = {
  current: {
    usEquity: 72,
    intlEquity: 8,
    bonds: 3,
    cash: 5,
    employerStock: 12,
  },
  recommended: {
    usEquity: 53.2,
    intlEquity: 22.8,
    bonds: 19,
    cash: 5,
  },
};

// Portfolio performance history (monthly returns)
export function generatePortfolioHistory() {
  const data = [];
  const start = new Date('2023-03-01');
  let value = 2200000;
  let sp500 = 2200000;
  const current = new Date(start);

  while (current <= new Date('2026-02-27')) {
    const ret = 0.008 + (Math.random() - 0.5) * 0.04;
    const spRet = 0.009 + (Math.random() - 0.5) * 0.035;
    value *= (1 + ret);
    sp500 *= (1 + spRet);
    data.push({
      date: current.toISOString().split('T')[0],
      portfolio: Math.round(value),
      sp500: Math.round(sp500),
    });
    current.setDate(current.getDate() + 7);
  }
  return data;
}

export const mockPortfolioHistory = generatePortfolioHistory();

// Vesting events for next 24 months
export const mockVestingEvents = (() => {
  const events = [];
  const now = new Date('2026-03-01');
  for (let i = 0; i < 8; i++) {
    const vestDate = new Date(now);
    vestDate.setMonth(vestDate.getMonth() + (i * 3));
    events.push({
      date: vestDate.toISOString().split('T')[0],
      grantId: i < 4 ? '1' : '2',
      shares: i < 4 ? 63 : 31,
      grossValue: (i < 4 ? 63 : 31) * 190.50,
      afterTaxValue: (i < 4 ? 63 : 31) * 190.50 * 0.557, // ~44.3% taxes (fed 35% + state 9.3%)
    });
  }
  return events;
})();

// AI Insights
export const mockInsights = [
  {
    id: '1',
    icon: '📅',
    title: 'Next RSU Vest',
    body: '63 shares of AMZN vest on March 15, 2026. Estimated after-tax value: $6,686.',
    type: 'info' as const,
  },
  {
    id: '2',
    icon: '⚠️',
    title: 'Concentration Risk',
    body: 'Amazon stock represents 12% of your net worth. Consider diversifying to reduce single-stock risk.',
    type: 'warning' as const,
  },
  {
    id: '3',
    icon: '🔥',
    title: 'FIRE Trajectory',
    body: 'At your current savings rate, you\'re on track to reach FI by Q2 2028 — 6 months ahead of your target.',
    type: 'success' as const,
  },
];

// ETF recommendations
export const mockETFRecommendations = {
  usEquity: [
    { ticker: 'VTI', name: 'Vanguard Total Stock Market', expenseRatio: 0.03, return10yr: 12.1 },
    { ticker: 'VOO', name: 'Vanguard S&P 500', expenseRatio: 0.03, return10yr: 12.3 },
    { ticker: 'SCHB', name: 'Schwab U.S. Broad Market', expenseRatio: 0.03, return10yr: 12.0 },
  ],
  intlEquity: [
    { ticker: 'VXUS', name: 'Vanguard Total Intl Stock', expenseRatio: 0.07, return10yr: 4.8 },
    { ticker: 'IXUS', name: 'iShares Core MSCI Total Intl', expenseRatio: 0.07, return10yr: 4.7 },
    { ticker: 'SPDW', name: 'SPDR Portfolio Dev World', expenseRatio: 0.04, return10yr: 5.1 },
  ],
  bonds: [
    { ticker: 'BND', name: 'Vanguard Total Bond Market', expenseRatio: 0.03, return10yr: 1.4 },
    { ticker: 'AGG', name: 'iShares Core US Aggregate Bond', expenseRatio: 0.03, return10yr: 1.3 },
    { ticker: 'SCHZ', name: 'Schwab US Aggregate Bond', expenseRatio: 0.03, return10yr: 1.3 },
  ],
};
