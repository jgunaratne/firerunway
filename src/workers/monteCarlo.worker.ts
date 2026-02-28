// Monte Carlo Simulation Web Worker
// Runs 10,000 simulations off the main thread to prevent UI blocking

interface LifeEvent {
  id: string;
  type: 'quit' | 'layoff' | 'college' | 'purchase' | 'windfall' | 'expense';
  label: string;
  emoji: string;
  year: number;
  params: Record<string, number>;
}

interface SimulationParams {
  startingPortfolio: number;
  annualContribution: number;
  annualSpend: number;
  retirementSpend: number;
  equityPct: number;
  bondPct: number;
  inflationRate: number;
  years: number;
  fireNumber: number;
  lifeEvents: LifeEvent[];
  numSimulations: number;
}

interface SimulationResult {
  percentiles: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
  };
  successRate: number;
  medianFinalValue: number;
}

function runMonteCarlo(params: SimulationParams): SimulationResult {
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
          yearContribution = event.params.partTimeIncome ?? 0;
          yearExpense = params.retirementSpend;
        }
        if (event.type === 'college') {
          yearExpense += (event.params.annualCost ?? 55000) - (event.params.plan529Annual ?? 0);
        }
        if (event.type === 'layoff') {
          yearContribution = event.params.severance ?? 0;
        }
        if (event.type === 'windfall') {
          yearContribution += event.params.amount ?? 0;
        }
        if (event.type === 'expense') {
          yearExpense += event.params.amount ?? 0;
        }
        if (event.type === 'purchase') {
          yearExpense += event.params.downPayment ?? 0;
        }
      }

      portfolio = portfolio * (1 + annualReturn) + yearContribution - yearExpense;
      annualSpend *= (1 + params.inflationRate);
      yearlyValues.push(Math.max(portfolio, 0));

      if (portfolio <= 0) {
        failed = true;
        for (let r = year + 1; r <= params.years; r++) yearlyValues.push(0);
        break;
      }
    }

    if (!failed) successes++;
    allRuns.push(yearlyValues);
  }

  // Calculate percentiles for each year
  const percentiles: SimulationResult['percentiles'] = { p10: [], p25: [], p50: [], p75: [], p90: [] };
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

// Listen for messages from the main thread
self.addEventListener('message', (event: MessageEvent<SimulationParams>) => {
  const result = runMonteCarlo(event.data);
  self.postMessage(result);
});
