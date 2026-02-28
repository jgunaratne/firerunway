// Financial calculations for FireRunway

export interface UserFinancialData {
  currentInvestableAssets: number;
  fireNumber: number;
  liquidAssets: number;
  annualSpend: number;
  employerStockValue: number;
  totalNetWorth: number;
  isEmployed: boolean;
  annualIncome: number;
}

export function calculateFIScore(data: UserFinancialData): {
  total: number;
  breakdown: { factor: string; value: string; weight: number; points: number }[];
} {
  const fundingRatio = data.currentInvestableAssets / data.fireNumber;
  const fundingScore = Math.min(fundingRatio * 40, 40);

  const runwayYears = data.liquidAssets / data.annualSpend;
  const runwayScore = Math.min((runwayYears / 20) * 25, 25);

  const concentrationPct = data.employerStockValue / data.totalNetWorth;
  const concentrationScore = Math.max(15 - concentrationPct * 30, 0);

  const employmentScore = data.isEmployed ? 10 : 0;

  const savingsRate = (data.annualIncome - data.annualSpend) / data.annualIncome;
  const savingsScore = Math.min((savingsRate / 0.5) * 10, 10);

  const total = Math.round(
    fundingScore + runwayScore + concentrationScore + employmentScore + savingsScore
  );

  return {
    total,
    breakdown: [
      { factor: 'Portfolio vs FIRE number', value: `${Math.round(fundingRatio * 100)}% funded`, weight: 40, points: Math.round(fundingScore * 10) / 10 },
      { factor: 'Runway (years)', value: `${runwayYears.toFixed(1)} yrs`, weight: 25, points: Math.round(runwayScore * 10) / 10 },
      { factor: 'Concentration risk', value: `${Math.round(concentrationPct * 100)}%${concentrationPct > 0.25 ? ' (high)' : concentrationPct > 0.15 ? ' (moderate)' : ''}`, weight: 15, points: Math.round(concentrationScore * 10) / 10 },
      { factor: 'Income stability', value: data.isEmployed ? 'Employed' : 'Unemployed', weight: 10, points: employmentScore },
      { factor: 'Savings rate', value: `${Math.round(savingsRate * 100)}%`, weight: 10, points: Math.round(savingsScore * 10) / 10 },
    ],
  };
}

export function getRecommendedAllocation(age: number, yearsToFire: number) {
  const baseEquity = Math.min(110 - age, 95);
  const fireAdjustment = yearsToFire < 5 ? -10 : yearsToFire < 10 ? -5 : 0;
  const equityPct = baseEquity + fireAdjustment;

  return {
    usEquity: Math.round(equityPct * 0.7 * 10) / 10,
    intlEquity: Math.round(equityPct * 0.3 * 10) / 10,
    bonds: Math.round((100 - equityPct - 5) * 10) / 10,
    cash: 5,
  };
}

export function calcRentalMetrics(property: {
  monthlyRent: number | null;
  currentValue: number;
  monthlyPayment: number;
  purchasePrice: number;
  originalLoanAmount: number;
}) {
  if (!property.monthlyRent) return null;
  const annualRent = property.monthlyRent * 12;
  const noi = annualRent * 0.65;
  const capRate = noi / property.currentValue;
  const annualMortgage = property.monthlyPayment * 12;
  const cashFlow = noi - annualMortgage;
  const cashInvested = property.purchasePrice - property.originalLoanAmount;
  const cashOnCash = cashInvested > 0 ? cashFlow / cashInvested : 0;
  return { noi: Math.round(noi), capRate, cashFlow: Math.round(cashFlow), cashOnCash };
}

export function calculateRunway(liquidAssets: number, annualSpend: number): number {
  return liquidAssets / annualSpend;
}

export function generateAmortizationSchedule(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  extraMonthly: number = 0
) {
  const monthlyRate = annualRate / 100 / 12;
  const schedule = [];
  let remaining = balance;

  for (let month = 1; remaining > 0 && month <= 360; month++) {
    const interest = remaining * monthlyRate;
    const totalPayment = Math.min(monthlyPayment + extraMonthly, remaining + interest);
    const principal = totalPayment - interest;
    remaining = Math.max(0, remaining - principal);

    schedule.push({
      month,
      payment: Math.round(totalPayment),
      principal: Math.round(principal),
      interest: Math.round(interest),
      balance: Math.round(remaining),
    });

    if (remaining <= 0) break;
  }
  return schedule;
}

export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}
