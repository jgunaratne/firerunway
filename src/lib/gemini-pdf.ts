/**
 * Gemini PDF extraction and AI analysis service.
 * Uses the @google/genai JS SDK.
 */

import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-2.5-flash';

function getClient(): GoogleGenAI {
  const project = process.env.GCP_PROJECT_ID ?? '';
  const location = process.env.GCP_LOCATION ?? 'us-central1';

  if (project) {
    return new GoogleGenAI({ vertexai: true, project, location });
  }

  const apiKey = process.env.GEMINI_API_KEY ?? '';
  if (apiKey) {
    return new GoogleGenAI({ apiKey });
  }

  throw new Error('Set either GCP_PROJECT_ID (for Vertex AI) or GEMINI_API_KEY');
}

function cleanJson(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '');
    cleaned = cleaned.replace(/\n?```\s*$/, '');
  }
  return cleaned.trim();
}

function makeFallback(error: string): Record<string, unknown> {
  return {
    broker: 'unknown',
    accountNumber: '',
    accountType: '',
    statementDate: '',
    totalValue: 0,
    cashBalance: 0,
    holdings: [],
    extractionConfidence: 'low',
    extractionNotes: error,
  };
}

const EXTRACTION_PROMPT = `Act as a personal financial analyst. You are reviewing a brokerage statement or investment report. Your job is to extract a complete, structured inventory of every account and holding.

## Step 1: Understand the Document

First, identify:
- **Broker** (Fidelity, Schwab, Vanguard, etc.) from the header/logo
- **Statement date** from the cover page or header
- **All accounts** listed (account numbers, types, ending values)

## Step 2: Account Segmentation

For each account in the report:
- Note the account number (mask all but last 4 digits: e.g., "****5532")
- Note the account type (Brokerage, IRA, 401k, Roth IRA, etc.)
- Note the ending/total value and cash balance

## Step 3: Extract Every Holding

Go through EVERY account section and extract EVERY position/holding listed. A large report may have 50-100+ positions — extract ALL of them, do not stop early.

For each holding, capture:
- Symbol/ticker
- Full name
- Quantity (shares)
- Price per share
- Total market value
- Cost basis (if shown, null otherwise)
- Unrealized gain/loss (if shown, null otherwise)

## Step 4: Classify Each Holding

For asset class, use: "us_equity", "intl_equity", "bond", "cash", "real_estate", "other"
For type, use: "etf", "stock", "mutual_fund", "bond", "cash", "money_market"

## Step 5: Output

Return ONLY a JSON object in this exact schema. No markdown, no explanation, just the JSON:

{
  "broker": "fidelity" | "schwab" | "vanguard" | "webull" | "unknown",
  "accountNumber": "****XXXX",
  "accountType": "string",
  "statementDate": "YYYY-MM-DD",
  "totalValue": number,
  "cashBalance": number,
  "holdings": [
    {
      "symbol": "string",
      "name": "string",
      "assetClass": "us_equity" | "intl_equity" | "bond" | "cash" | "real_estate" | "other",
      "type": "etf" | "stock" | "mutual_fund" | "bond" | "cash" | "money_market",
      "quantity": number,
      "price": number,
      "marketValue": number,
      "costBasis": number | null,
      "unrealizedGainLoss": number | null,
      "percentOfAccount": number
    }
  ],
  "extractionConfidence": "high" | "medium" | "low",
  "extractionNotes": "string or null"
}

If the report contains MULTIPLE accounts, combine all holdings into a single holdings array. Use the largest account number for accountNumber, and sum all accounts for totalValue and cashBalance.

## Important Rules
- All dollar amounts: plain numbers (no $ or commas)
- percentOfAccount = (marketValue / totalValue) * 100
- If a position shows $0 market value, skip it
- Include money market / cash sweep positions
- DO NOT include transaction history, realized gains, or activity — only current positions`;

const TAX_EXTRACTION_PROMPT = `Act as a personal tax advisor reviewing a W-2, 1099, tax return, or pay stub document.

## Step 1: Identify the Document

First, identify:
- **Document type**: W-2, 1099-MISC, 1099-DIV, 1099-INT, 1099-B, 1040, pay stub
- **Tax year** from the document header
- **Employer name** (if W-2 or pay stub)
- **Employee/taxpayer name** (mask to first name + last initial only)

## Step 2: Extract Income Breakdown

Extract every income source found in the document:
- **salary**: Base wages/salary (W-2 Box 1, or gross pay on pay stub)
- **bonus**: Any bonus or incentive pay (if itemized separately)
- **rsu**: Restricted stock unit income / stock compensation
- **espp**: Employee Stock Purchase Plan income
- **overtime**: Overtime pay
- **commission**: Commission income
- **dividends**: Dividend income (1099-DIV)
- **interest**: Interest income (1099-INT)
- **capital_gains**: Capital gains (1099-B, Schedule D)
- **rental**: Rental income
- **other**: Any other taxable income

If a category is not present in the document, omit it.

## Step 3: Extract Tax Breakdown

Extract every tax withholding or tax paid:
- **federal**: Federal income tax withheld (W-2 Box 2)
- **state**: State income tax withheld (W-2 Box 17)
- **local**: Local/city income tax
- **fica_ss**: Social Security tax (W-2 Box 4)
- **fica_medicare**: Medicare tax (W-2 Box 6)
- **state_disability**: SDI / state disability insurance
- **retirement_401k**: 401(k) pre-tax contributions (W-2 Box 12, Code D)
- **retirement_roth**: Roth 401(k) contributions (W-2 Box 12, Code AA)
- **hsa**: HSA contributions (W-2 Box 12, Code W)
- **other**: Any other deductions or taxes

## Step 4: Calculate Summary

- **total_income**: Sum of all income categories
- **total_tax**: Sum of all tax categories (excluding retirement contributions)
- **effective_tax_rate**: total_tax / total_income as a decimal (e.g., 0.28 for 28%)

## Step 5: Output JSON

Return ONLY a JSON object, no markdown, no explanation:

{
  "documentType": "w2" | "1099" | "tax_return" | "pay_stub",
  "taxYear": 2025,
  "employer": "string",
  "incomeBreakdown": {
    "salary": number,
    "bonus": number
  },
  "totalIncome": number,
  "taxBreakdown": {
    "federal": number,
    "state": number,
    "fica_ss": number,
    "fica_medicare": number
  },
  "totalTax": number,
  "effectiveTaxRate": number,
  "retirement401k": number,
  "retirementRoth": number,
  "hsaContributions": number,
  "extractionConfidence": "high" | "medium" | "low",
  "extractionNotes": "string or null"
}

## Rules
- All amounts: plain numbers (no $ or commas)
- If the document has YTD totals, use those (most complete data)
- For W-2s, use the annual totals, not per-pay-period amounts
- If multiple W-2s or 1099s are in one PDF, combine them into one result
- Mask SSNs — never include them in the output`;

export async function parsePdf(pdfBuffer: Buffer, filename: string = ''): Promise<Record<string, unknown>> {
  console.log(`[Gemini] Starting extraction for: ${filename} (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

  const client = getClient();
  const t0 = Date.now();

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: pdfBuffer.toString('base64'), mimeType: 'application/pdf' } },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      config: {
        maxOutputTokens: 65536,
        temperature: 0.1,
      },
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[Gemini] API call completed in ${elapsed}s`);

    const rawText = response.text ?? '';
    if (!rawText) {
      console.warn('[Gemini] Empty response');
      return makeFallback('Gemini returned empty response');
    }

    const cleaned = cleanJson(rawText);
    try {
      const data = JSON.parse(cleaned) as Record<string, unknown>;
      const holdings = data.holdings as Record<string, unknown>[] ?? [];
      console.log(`[Gemini] ✅ ${holdings.length} holdings, total=$${((data.totalValue as number) ?? 0).toLocaleString()}`);
      return data;
    } catch (e) {
      console.error('[Gemini] JSON parse failed:', e);
      return makeFallback(`JSON parse error: ${e}`);
    }
  } catch (e) {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.error(`[Gemini] ❌ API call FAILED after ${elapsed}s:`, e);
    return makeFallback(`Gemini API call failed: ${e}`);
  }
}

export async function parseTaxPdf(pdfBuffer: Buffer, filename: string = ''): Promise<Record<string, unknown>> {
  console.log(`[Tax] Starting extraction for: ${filename} (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

  const client = getClient();
  const t0 = Date.now();

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: pdfBuffer.toString('base64'), mimeType: 'application/pdf' } },
            { text: TAX_EXTRACTION_PROMPT },
          ],
        },
      ],
      config: {
        maxOutputTokens: 16384,
        temperature: 0.1,
      },
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[Tax] API call completed in ${elapsed}s`);

    const rawText = response.text ?? '';
    if (!rawText) return { error: 'Gemini returned empty response' };

    const cleaned = cleanJson(rawText);
    try {
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch (e) {
      console.error('[Tax] JSON parse failed:', e);
      return { error: `Failed to parse response: ${e}`, raw: cleaned.slice(0, 500) };
    }
  } catch (e) {
    console.error(`[Tax] API call failed for ${filename}:`, e);
    return { error: `Extraction failed: ${e}` };
  }
}

export async function analyzeWithGemini(prompt: string): Promise<string> {
  const client = getClient();
  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 4096, temperature: 0.3 },
    });
    return response.text ?? 'Analysis unavailable.';
  } catch (e) {
    console.error('[Gemini] Analysis failed:', e);
    return `Analysis failed: ${e}`;
  }
}
