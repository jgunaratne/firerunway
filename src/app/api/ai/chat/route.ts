export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getClient, MODEL } from '@/lib/gemini-pdf';

const SYSTEM_PROMPT = `You are a helpful financial advisor assistant embedded in FireRunway, a financial independence dashboard for tech workers.

RULES:
- You have access to the user's financial data for the current page they are viewing (provided below).
- Answer questions about their data with specifics — reference actual numbers, holdings, accounts, etc.
- Be concise but thorough. Use bullet points for lists.
- If the user asks something outside finance, politely redirect.
- Always note that this is educational information, not personalized investment advice.
- Do NOT use markdown headers (# or ##). Use bold (**text**) for emphasis and bullet points for structure.
- Keep responses focused and under 300 words unless the user asks for detail.`;

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export async function POST(request: NextRequest) {
  const hasAnyKey = process.env.GCP_PROJECT_ID || process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!hasAnyKey) {
    return NextResponse.json({
      reply: "AI chat is not configured. Please set a GEMINI_API_KEY or GCP_PROJECT_ID environment variable.",
    });
  }

  try {
    const { messages, pageContext } = await request.json() as {
      messages: ChatMessage[];
      pageContext: string;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    const systemInstruction = `${SYSTEM_PROMPT}\n\n## Current Page Context\n${pageContext || 'No specific page data available.'}`;

    // Try Gemini first
    try {
      const client = getClient();
      const response = await client.models.generateContent({
        model: MODEL,
        contents: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        })),
        config: {
          maxOutputTokens: 2048,
          temperature: 0.4,
          systemInstruction,
        },
      });

      return NextResponse.json({ reply: response.text ?? '' });
    } catch (geminiError) {
      console.warn('Gemini chat failed, trying Claude fallback:', geminiError);

      // Claude fallback
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw geminiError;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2048,
          system: systemInstruction,
          messages: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        }),
      });

      if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
      const data = await res.json();
      return NextResponse.json({ reply: data.content?.[0]?.text ?? '' });
    }
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
