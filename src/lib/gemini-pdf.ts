/**
 * Gemini PDF extraction and AI analysis service.
 * Uses the @google/genai JS SDK.
 */

import { GoogleGenAI } from '@google/genai';

export const MODEL = 'gemini-2.5-flash';

export function getClient(): GoogleGenAI {
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

const RSU_EXTRACTION_PROMPT = `You are extracting RSU (Restricted Stock Unit) grant data from an equity awards document, likely from Schwab Equity Awards, E*Trade, Fidelity, or Morgan Stanley.

## Document Layout (Schwab Equity Awards)

The document typically contains these sections in order:

1. **Companies section** (top-right): Shows stock ticker(s) and current price, e.g. "GOOG $297.18" or "AMZN $190.50". USE THIS AS THE TICKER.

2. **"Equity Today" / Current Positions table**: Shows VESTED shares.
   - "Total Owned Shares" = shares already vested and owned
   - "Vested Award Shares" = same as above
   - These are the VESTED shares

3. **"Unvested Awards" table**: Shows UNVESTED shares.
   - "Total Unvested Awards" = total shares not yet vested
   - "Unvested Restricted Stock Units" = the RSU portion (use this number, ignore "Dividend Equivalent Rights")

4. **"Future Vesting Details" table**: Monthly/quarterly breakdown of upcoming vests.
   - Columns: Vesting Date, Vesting Quantity, Current Market Value, Award Date, Symbol, Award ID, Award Type
   - Each unique **Award ID** + **Award Date** combination = one distinct grant
   - The vesting quantities per month show how many shares vest from each grant

## How to Extract Grants

1. Find the stock **ticker** from the Companies section or the Symbol column (e.g., "GOOG", "AMZN")
2. Look at the Future Vesting Details table to identify DISTINCT grants by their unique **Award ID** and **Award Date** combinations
3. For each distinct grant:
   - **company_ticker**: The stock symbol from the Symbol column or Companies section
   - **grant_date**: The "Award Date" column value for this grant (format: YYYY-MM-DD)
   - **total_shares**: Sum ALL the "Vesting Quantity" values in the Future Vesting Details for this Award ID. Then add any shares from this grant that have already vested (you can estimate this from the overall vested count proportionally, or set it to the unvested sum if you cannot determine)
   - **vested_shares**: If you can determine how many shares from this specific grant have already vested, use that. Otherwise estimate by distributing the overall "Vested Award Shares" count proportionally across grants based on their Award Date (older grants have vested more)
   - **vest_frequency**: Look at the vesting dates — if vests happen every month (e.g., 03/25, 04/25, 05/25), use "monthly". If every 3 months, use "quarterly"
   - **vest_period_months**: 48 (standard 4-year vesting) unless evidence suggests otherwise
   - **cliff_months**: 12 unless evidence suggests otherwise

## Output Format

Return ONLY a JSON object:

{
  "grants": [
    {
      "company_ticker": "GOOG",
      "grant_date": "2024-03-06",
      "total_shares": 500,
      "vested_shares": 120,
      "vest_period_months": 48,
      "vest_frequency": "monthly",
      "cliff_months": 12
    }
  ],
  "extractionConfidence": "high" | "medium" | "low",
  "extractionNotes": "Brief description of what you found and any uncertainties"
}

## Critical Rules
- The ticker comes from the "Companies" section or "Symbol" column, NOT from the page title
- Do NOT use "GOOGL" — use "GOOG" (the Class C shares shown in equity awards)
- Each unique Award ID = one grant in the output
- "Unvested Restricted Stock Units" count is the total unvested RSUs (ignore "Dividend Equivalent Rights")
- "Total Owned Shares" or "Vested Award Shares" = total vested shares across all grants
- Vesting Quantity values in the Future Vesting Details are the UNVESTED shares that will vest on each date
- All share counts must be integers`;

export async function parseRsuPdf(pdfBuffer: Buffer, filename: string = ''): Promise<Record<string, unknown>> {
  console.log(`[RSU] Starting extraction for: ${filename} (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);

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
            { text: RSU_EXTRACTION_PROMPT },
          ],
        },
      ],
      config: {
        maxOutputTokens: 16384,
        temperature: 0.1,
      },
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[RSU] API call completed in ${elapsed}s`);

    const rawText = response.text ?? '';
    if (!rawText) return { grants: [], error: 'Gemini returned empty response' };

    const cleaned = cleanJson(rawText);
    try {
      const data = JSON.parse(cleaned) as Record<string, unknown>;
      const grants = (data.grants as Record<string, unknown>[]) ?? [];
      console.log(`[RSU] ✅ ${grants.length} grants extracted`);
      console.log(`[RSU] Extraction notes: ${data.extractionNotes}`);
      console.log(`[RSU] Confidence: ${data.extractionConfidence}`);
      for (const g of grants) {
        console.log(`[RSU]   Grant: ticker=${g.company_ticker} date=${g.grant_date} total=${g.total_shares} vested=${g.vested_shares} freq=${g.vest_frequency}`);
      }
      return data;
    } catch (e) {
      console.error('[RSU] JSON parse failed:', e);
      console.error('[RSU] Raw text (first 1000 chars):', cleaned.slice(0, 1000));
      return { grants: [], error: `Failed to parse response: ${e}`, raw: cleaned.slice(0, 1000) };
    }
  } catch (e) {
    console.error(`[RSU] API call failed for ${filename}:`, e);
    return { grants: [], error: `Extraction failed: ${e}` };
  }
}

const RSU_TEXT_PROMPT = `Extract RSU grant information from this pasted text. The text comes from an equity awards platform (Schwab, E*Trade, Fidelity, etc).

## EXAMPLE

Given this pasted text:
"""
AAPL $185.50
Current Positions  Quantity  Value
Total Owned Shares  300  $55,650.00
Vested Award Shares  300  $55,650.00
Unvested Awards  Quantity  Value
Total Unvested Awards  900  $166,950.00
Unvested Restricted Stock Units  880  $163,240.00
Unvested Dividend Equivalent Rights  500  $550.00
Future Vesting Details
Vesting Date  Vesting Quantity  Current Market Value  Award Date  Symbol  Award ID  Award Type
March 2025  60  $11,130.00
03/25/2025  40  $7,420.00  01/15/2023  AAPL  A001  RSU
  20  $3,710.00  06/01/2024  AAPL  A002  RSU
April 2025  60  $11,130.00
04/25/2025  40  $7,420.00  01/15/2023  AAPL  A001  RSU
  20  $3,710.00  06/01/2024  AAPL  A002  RSU
"""

Step-by-step extraction:

1. TICKER = "AAPL" (from price display at top)

2. TOTAL VESTED across all grants = 300 (from "Vested Award Shares" or "Total Owned Shares" — this is shares already vested and owned)

3. TOTAL UNVESTED RSUs = 880 (from "Unvested Restricted Stock Units" — ignore "Dividend Equivalent Rights")

4. IDENTIFY GRANTS by unique Award Date in the Future Vesting Details:
   - Grant A001: Award Date = 01/15/2023
   - Grant A002: Award Date = 06/01/2024

5. COMPUTE UNVESTED PER GRANT by summing Vesting Quantity for each Award ID across ALL months:
   - A001 unvested: 40 + 40 = 80 (from the rows shown, but there would be more months)
   - A002 unvested: 20 + 20 = 40

6. DISTRIBUTE VESTED: Total vested (300) is split across grants. Older grants have vested more.
   - A001 granted 01/15/2023 (older, more vested) → vested_shares ≈ 200
   - A002 granted 06/01/2024 (newer, less vested) → vested_shares ≈ 100

7. TOTAL SHARES per grant = vested + unvested for that grant:
   - A001: total_shares = 200 + 400 = 600 (estimated)
   - A002: total_shares = 100 + 480 = 580 (estimated)

Output:
{"grants":[
  {"company_ticker":"AAPL","grant_date":"2023-01-15","total_shares":600,"vested_shares":200,"vest_period_months":48,"vest_frequency":"monthly","cliff_months":12},
  {"company_ticker":"AAPL","grant_date":"2024-06-01","total_shares":580,"vested_shares":100,"vest_period_months":48,"vest_frequency":"monthly","cliff_months":12}
],"extractionConfidence":"high","extractionNotes":"Found 2 grants. Vested=300 split proportionally by grant age."}

## YOUR TASK

Extract from the user's text. CRITICAL STEPS:
1. Ticker: from price display or Symbol column (use GOOG not GOOGL)
2. Read "Vested Award Shares" or "Total Owned Shares" = total vested across all grants
3. Read "Unvested Restricted Stock Units" = total unvested RSUs (NOT "Total Unvested Awards" which may include non-RSU items)
4. Each unique Award Date in Future Vesting Details = one grant
5. For each grant, sum its Vesting Quantity across all months = that grant's unvested shares
6. Distribute total vested shares across grants proportionally by how long ago each was granted
7. total_shares = vested_shares + unvested_shares for each grant
8. vest_frequency = "monthly" if vesting dates are ~monthly, "quarterly" if every 3 months
9. Return ONLY valid JSON, no markdown, no code fences

{"grants":[...],"extractionConfidence":"high"|"medium"|"low","extractionNotes":"..."}`;


export async function parseRsuText(text: string): Promise<Record<string, unknown>> {
  console.log(`[RSU-Text] Starting extraction from ${text.length} chars of text`);

  const client = getClient();
  const t0 = Date.now();

  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: `Here is text copied from an equity awards page. Extract the RSU grant data:\n\n---\n${text}\n---\n\n${RSU_TEXT_PROMPT}` },
          ],
        },
      ],
      config: {
        maxOutputTokens: 16384,
        temperature: 0.1,
      },
    });

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[RSU-Text] API call completed in ${elapsed}s`);

    const rawText = response.text ?? '';
    if (!rawText) return { grants: [], error: 'Gemini returned empty response' };

    const cleaned = cleanJson(rawText);
    try {
      const data = JSON.parse(cleaned) as Record<string, unknown>;
      const grants = (data.grants as Record<string, unknown>[]) ?? [];
      console.log(`[RSU-Text] ✅ ${grants.length} grants extracted`);
      console.log(`[RSU-Text] Notes: ${data.extractionNotes}`);
      for (const g of grants) {
        console.log(`[RSU-Text]   Grant: ticker=${g.company_ticker} date=${g.grant_date} total=${g.total_shares} vested=${g.vested_shares}`);
      }
      return data;
    } catch (e) {
      console.error('[RSU-Text] JSON parse failed:', e);
      console.error('[RSU-Text] Raw:', cleaned.slice(0, 500));
      return { grants: [], error: `Failed to parse: ${e}`, raw: cleaned.slice(0, 500) };
    }
  } catch (e) {
    console.error('[RSU-Text] API call failed:', e);
    return { grants: [], error: `Extraction failed: ${e}` };
  }
}

export async function analyzeWithGemini(prompt: string, systemPrompt?: string): Promise<string> {
  const client = getClient();
  try {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        maxOutputTokens: 4096,
        temperature: 0.3,
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
      },
    });
    return response.text ?? 'Analysis unavailable.';
  } catch (e) {
    console.error('[Gemini] Analysis failed:', e);
    return `Analysis failed: ${e}`;
  }
}
