export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getClient, MODEL } from '@/lib/gemini-pdf';

// AI provider — Gemini/Vertex AI
async function callGemini(prompt: string, systemPrompt: string): Promise<string> {
  const client = getClient(); // Uses Vertex AI if GCP_PROJECT_ID is set, else GEMINI_API_KEY
  const response = await client.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      maxOutputTokens: 1024,
      temperature: 0.3,
      systemInstruction: systemPrompt,
    },
  });
  return response.text ?? '';
}

const FINANCIAL_SYSTEM_PROMPT = `You are a financial analysis assistant for FireRunway, a financial independence dashboard for tech workers. 
Provide concise, data-driven observations about the user's financial situation.
Focus on actionable insights.
Always note that this is educational information, not personalized investment advice.
Keep responses under 200 words.
Return valid JSON when asked for structured output.`;

// POST /api/ai/insights
// Generate AI-powered financial insights
export async function POST(request: NextRequest) {
  const hasAnyKey = process.env.GCP_PROJECT_ID || process.env.GEMINI_API_KEY;

  if (!hasAnyKey) {
    // Return mock insights when no AI provider is configured
    return NextResponse.json({
      insights: [
        {
          title: 'Next RSU Vest',
          body: 'Your next vesting event is in 45 days. 63 shares of AMZN worth approximately $12,000 at current price.',
          type: 'info',
        },
        {
          title: 'Concentration Risk',
          body: 'Employer stock represents 12% of your portfolio. Consider diversifying if it exceeds 15%.',
          type: 'warning',
        },
        {
          title: 'FIRE Trajectory',
          body: 'At your current savings rate, you\'re on track to reach FI by Q2 2028 — 6 months ahead of target.',
          type: 'success',
        },
      ],
      source: 'mock',
    });
  }

  try {
    const { financialData, requestType } = await request.json();

    let prompt: string;

    switch (requestType) {
      case 'insights':
        prompt = `Given this financial snapshot, generate exactly 3 insights as a JSON array. Each insight should have: title (string), body (string, under 50 words), type ('success' | 'warning' | 'info').

Financial data: ${JSON.stringify(financialData)}

Respond with ONLY the JSON array, no markdown.`;
        break;

      case 'monte-carlo-interpretation':
        prompt = `Interpret these Monte Carlo simulation results in plain English (2-3 sentences). Focus on the success rate, key risks, and one actionable recommendation.

Results: ${JSON.stringify(financialData)}

Respond with the interpretation text only.`;
        break;

      case 'score-levers':
        prompt = `Given this financial data, suggest the top 3 actions that would most improve the FIRE score. Return a JSON array where each item has: action (string, one sentence), impact (string like '+4 points'), icon (emoji).

Financial data: ${JSON.stringify(financialData)}

Respond with ONLY the JSON array.`;
        break;

      default:
        prompt = `Analyze this financial data and provide a brief observation: ${JSON.stringify(financialData)}`;
    }

    const response = await callGemini(prompt, FINANCIAL_SYSTEM_PROMPT);

    // Try to parse as JSON, fallback to text
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      parsed = response;
    }

    return NextResponse.json({
      result: parsed,
      source: 'gemini',
    });
  } catch (error) {
    console.error('AI insights error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}
