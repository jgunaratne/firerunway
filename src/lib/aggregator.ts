/**
 * Portfolio aggregation service.
 * Deduplicates holdings by symbol and provides breakdown summaries.
 */

interface AggregatedHolding {
  symbol: string;
  name: string;
  type: string;
  assetClass: string;
  quantity: number;
  marketValue: number;
  percentOfPortfolio: number;
  accounts: string[];
}

interface PortfolioSummary {
  totalNetWorth: number;
  byBroker: Record<string, number>;
  byAccountType: Record<string, number>;
  byAssetClass: Record<string, number>;
  holdings: AggregatedHolding[];
  holdingsCount: number;
}

export function aggregatePortfolio(holdings: Record<string, unknown>[]): PortfolioSummary {
  const byBroker: Record<string, number> = {};
  const byAccountType: Record<string, number> = {};
  const byAssetClass: Record<string, number> = {};
  const deduped = new Map<string, AggregatedHolding>();
  let totalNetWorth = 0;

  for (const h of holdings) {
    const mv = (h.market_value as number) ?? 0;
    const broker = (h.broker as string) ?? 'Unknown';
    const accountType = (h.account_type as string) ?? 'Unknown';
    const assetClass = (h.asset_class as string) ?? 'Other';
    const symbol = (h.symbol as string) ?? '';
    const accountLabel = `${broker} ${accountType}`.trim();

    totalNetWorth += mv;
    byBroker[broker] = (byBroker[broker] ?? 0) + mv;
    byAccountType[accountType] = (byAccountType[accountType] ?? 0) + mv;
    byAssetClass[assetClass] = (byAssetClass[assetClass] ?? 0) + mv;

    if (symbol && deduped.has(symbol)) {
      const existing = deduped.get(symbol)!;
      existing.marketValue += mv;
      existing.quantity += (h.quantity as number) ?? 0;
      if (!existing.accounts.includes(accountLabel)) {
        existing.accounts.push(accountLabel);
      }
    } else {
      deduped.set(symbol || `_${deduped.size}`, {
        symbol,
        name: (h.name as string) ?? '',
        type: (h.type as string) ?? 'stock',
        assetClass,
        marketValue: mv,
        quantity: (h.quantity as number) ?? 0,
        percentOfPortfolio: 0,
        accounts: [accountLabel],
      });
    }
  }

  const holdingsList = Array.from(deduped.values())
    .sort((a, b) => b.marketValue - a.marketValue)
    .map(h => ({
      ...h,
      percentOfPortfolio: totalNetWorth > 0
        ? Math.round((h.marketValue / totalNetWorth) * 10000) / 100
        : 0,
    }));

  for (const key of Object.keys(byBroker)) byBroker[key] = Math.round(byBroker[key] * 100) / 100;
  for (const key of Object.keys(byAccountType)) byAccountType[key] = Math.round(byAccountType[key] * 100) / 100;
  for (const key of Object.keys(byAssetClass)) byAssetClass[key] = Math.round(byAssetClass[key] * 100) / 100;

  return {
    totalNetWorth: Math.round(totalNetWorth * 100) / 100,
    byBroker,
    byAccountType,
    byAssetClass,
    holdings: holdingsList,
    holdingsCount: holdingsList.length,
  };
}
