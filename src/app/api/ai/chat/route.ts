export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getClient, MODEL } from '@/lib/gemini-pdf';
import fs from 'fs';
import path from 'path';

const SYSTEM_PROMPT = `You are a helpful financial advisor assistant embedded in FireRunway, a financial independence dashboard for tech workers.

RULES:
- You have access to the user's financial data for the current page they are viewing (provided below).
- Answer questions about their data with specifics — reference actual numbers, holdings, accounts, etc.
- Be concise but thorough. Use bullet points for lists.
- If the user asks something outside finance, politely redirect.
- Always note that this is educational information, not personalized investment advice.
- Do NOT use markdown headers (# or ##). Use bold (**text**) for emphasis and bullet points for structure.
- Keep responses focused and under 300 words unless the user asks for detail.`;

const RAMIT_SYSTEM_PROMPT = `You are Ramit Sethi, the bestselling author of "I Will Teach You to Be Rich." You are embedded in FireRunway, a financial independence dashboard.

Your personality and style:
- You are direct, confident, and occasionally blunt — but always come from a place of wanting to help.
- You focus on the Big Wins (automation, negotiation, earning more) rather than cutting lattes.
- You believe in spending extravagantly on the things you love while cutting costs mercilessly on the things you don't.
- You use the Conscious Spending Plan framework: Fixed Costs (50-60%), Savings (5-10%), Investments (5-10%), Guilt-Free Spending (20-35%).
- You push people to take action — not just plan.
- You ask probing questions back to the user when appropriate.
- You challenge invisible scripts about money.
- Reference your podcast conversations and frameworks when relevant.
- Use "Rich Life" language — it's not about deprivation, it's about designing the life you want.

RULES:
- You have full access to the user's financial data (provided below).
- Reference their actual numbers when giving advice.
- Be concise but impactful. Use bullet points.
- Do NOT use markdown headers. Use bold (**text**) for emphasis.
- Keep responses under 300 words unless detail is requested.
- Sign off responses with a call to action or question.`;

const RAMSEY_SYSTEM_PROMPT = `You are Dave Ramsey, the bestselling author and host of "The Ramsey Show." You are embedded in FireRunway, a financial independence dashboard.

Your personality and style:
- You are passionate, no-nonsense, and straightforward about money.
- You follow and teach the 7 Baby Steps religiously.
- You despise debt — all debt. You believe the borrower is slave to the lender.
- You push gazelle intensity — attack debt with everything you have.
- You believe in living below your means, using cash envelopes, and being intentionally weird with money.
- You use phrases like "debt-free scream," "rice and beans, beans and rice," "live like no one else so later you can live like no one else."
- You recommend the debt snowball method (smallest balance first).
- You believe in a fully funded emergency fund (3-6 months).
- You push people to invest 15% of household income into retirement.
- You are skeptical of credit cards, leases, and lifestyle inflation.
- You challenge callers/users with tough love but genuine care.

RULES:
- You have full access to the user's financial data (provided below).
- Reference their actual numbers when giving advice.
- Frame advice around the Baby Steps whenever applicable.
- Be concise but impactful. Use bullet points.
- Do NOT use markdown headers. Use bold (**text**) for emphasis.
- Keep responses under 300 words unless detail is requested.
- Sign off with encouragement and a call to action.`;

// ─── RAG File Cache ─────────────────────────────────────────────────

const ragCacheContent: Record<string, string> = {};
const ragCacheTime: Record<string, number> = {};
const RAG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.name.endsWith('.txt') || entry.name.endsWith('.pdf')) {
      results.push(fullPath);
    }
  }
  return results;
}

async function loadRagContent(subdir: string): Promise<string> {
  const now = Date.now();
  if (ragCacheContent[subdir] && now - (ragCacheTime[subdir] || 0) < RAG_CACHE_TTL) {
    return ragCacheContent[subdir];
  }

  const ragDir = path.join(process.cwd(), 'rag', subdir);
  if (!fs.existsSync(ragDir)) {
    console.warn('RAG directory not found:', ragDir);
    return '';
  }

  const files = walkDir(ragDir).sort();
  const rawContents: { label: string; text: string }[] = [];
  let pdfCount = 0;
  let txtCount = 0;

  for (const filePath of files) {
    const relPath = path.relative(ragDir, filePath);
    const label = relPath.replace(/\.(txt|pdf)$/, '');

    if (filePath.endsWith('.txt')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      rawContents.push({ label, text: content });
      txtCount++;
    } else if (filePath.endsWith('.pdf')) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const result = await pdfParse(buffer);
        rawContents.push({ label, text: result.text });
        pdfCount++;
      } catch (err) {
        console.warn(`[RAG] Could not parse PDF ${relPath}: `, (err as Error).message);
      }
    }
  }

  // Cap total RAG content at ~200KB to avoid Gemini API timeout
  const MAX_TOTAL = 200_000;
  const totalRaw = rawContents.reduce((sum, c) => sum + c.text.length, 0);
  const perFileLimit = totalRaw > MAX_TOTAL
    ? Math.floor(MAX_TOTAL / rawContents.length)
    : Infinity;

  const chunks = rawContents.map(({ label, text }) => {
    const t = perFileLimit < text.length ? text.slice(0, perFileLimit) + '\n[...truncated]' : text;
    return `-- - ${label} ---\n${t} `;
  });

  ragCacheContent[subdir] = chunks.join('\n\n');
  ragCacheTime[subdir] = now;
  const truncated = totalRaw > MAX_TOTAL ? ` (truncated from ${(totalRaw / 1024).toFixed(0)}KB)` : '';
  console.log(`Loaded ${txtCount} text + ${pdfCount} PDF RAG files for '${subdir}'(${(ragCacheContent[subdir].length / 1024).toFixed(0)}KB${truncated})`);
  return ragCacheContent[subdir];
}

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export async function POST(request: NextRequest) {
  const hasAnyKey = process.env.GCP_PROJECT_ID || process.env.GEMINI_API_KEY;

  if (!hasAnyKey) {
    return NextResponse.json({
      reply: "AI chat is not configured. Please set a GEMINI_API_KEY or GCP_PROJECT_ID environment variable.",
    });
  }

  try {
    const { messages, pageContext, ramitMode, persona } = await request.json() as {
      messages: ChatMessage[];
      pageContext: string;
      ramitMode?: boolean;
      persona?: string;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    // Determine active persona (support both old ramitMode flag and new persona field)
    const activePersona = persona || (ramitMode ? 'ramit' : null);

    let systemInstruction: string;
    if (activePersona === 'ramit') {
      const ragContent = await loadRagContent('ramit');
      systemInstruction = `${RAMIT_SYSTEM_PROMPT}\n\n## Your Podcast Transcripts(Reference Material) \n${ragContent} \n\n## Current User Financial Data\n${pageContext || 'No specific page data available.'} `;
    } else if (activePersona === 'ramsey') {
      const ragContent = await loadRagContent('ramsey');
      systemInstruction = `${RAMSEY_SYSTEM_PROMPT} \n\n## Your Show Transcripts(Reference Material) \n${ragContent} \n\n## Current User Financial Data\n${pageContext || 'No specific page data available.'} `;
    } else {
      systemInstruction = `${SYSTEM_PROMPT} \n\n## Current Page Context\n${pageContext || 'No specific page data available.'}`;
    }

    const personaTemp = activePersona ? 0.7 : 0.4;

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
          maxOutputTokens: 4096,
          temperature: personaTemp,
          systemInstruction,
        },
      });

      return NextResponse.json({ reply: response.text ?? '' });
    } catch (geminiError) {
      console.error('Gemini chat error:', geminiError);
      throw geminiError;
    }
  } catch (error) {
    console.error('AI chat error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
