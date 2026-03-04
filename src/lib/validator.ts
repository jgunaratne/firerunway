/**
 * Post-extraction validation for parsed brokerage statements.
 */

export function validateExtraction(data: Record<string, unknown>): { confidence: string; notes: string | null } {
  let confidence = (data.extractionConfidence as string) ?? 'medium';
  const warnings: string[] = [];

  const holdings = (data.holdings as Record<string, unknown>[]) ?? [];
  const totalValue = (data.totalValue as number) ?? 0;

  if (holdings.length === 0) {
    confidence = 'low';
    warnings.push('No holdings were extracted from the statement.');
  }

  const dateStr = (data.statementDate as string) ?? '';
  if (dateStr) {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      confidence = 'low';
      warnings.push(`Statement date '${dateStr}' is not a valid date.`);
    }
  } else {
    confidence = 'low';
    warnings.push('No statement date was extracted.');
  }

  for (const h of holdings) {
    if (((h.quantity as number) ?? 0) < 0) {
      confidence = 'low';
      warnings.push(`Negative quantity for ${h.symbol ?? '?'}: ${h.quantity}`);
    }
    if (((h.price as number) ?? 0) < 0) {
      confidence = 'low';
      warnings.push(`Negative price for ${h.symbol ?? '?'}: ${h.price}`);
    }
  }

  if (totalValue > 0 && holdings.length > 0) {
    const holdingsSum = holdings.reduce((s, h) => s + ((h.marketValue as number) ?? 0), 0);
    const cash = (data.cashBalance as number) ?? 0;
    const accounted = holdingsSum + cash;
    const diffPct = Math.abs(accounted - totalValue) / totalValue;

    if (diffPct > 0.05) {
      if (confidence === 'high') confidence = 'medium';
      warnings.push(
        `Holdings + cash (${accounted.toLocaleString()}) differs from total value ` +
        `(${totalValue.toLocaleString()}) by ${(diffPct * 100).toFixed(1)}%.`
      );
    }
  }

  const notes = warnings.length > 0 ? warnings.join('; ') : (data.extractionNotes as string | null) ?? null;
  return { confidence, notes };
}
