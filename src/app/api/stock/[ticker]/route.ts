export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/stock/[ticker]
// Fetches current stock price from Massive.com (formerly Polygon.io)
export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const { ticker } = params;
  const apiKey = process.env.POLYGON_API_KEY;

  if (!apiKey) {
    // Return mock price when Massive.com API key is not configured
    const mockPrices: Record<string, number> = {
      AMZN: 190.50,
      AAPL: 178.25,
      GOOG: 297.18,
      GOOGL: 297.38,
      MSFT: 415.60,
      META: 485.30,
    };
    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      price: mockPrices[ticker.toUpperCase()] ?? 100.00,
      source: 'mock',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // Massive.com (formerly Polygon.io) previous day close
    const res = await fetch(
      `https://api.massive.com/v2/aggs/ticker/${ticker.toUpperCase()}/prev?adjusted=true&apiKey=${apiKey}`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!res.ok) {
      throw new Error(`Massive.com API error: ${res.status}`);
    }

    const data = await res.json();
    const result = data.results?.[0];

    if (!result) {
      return NextResponse.json(
        { error: `No data found for ticker ${ticker}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      price: result.c, // close price
      open: result.o,
      high: result.h,
      low: result.l,
      volume: result.v,
      source: 'massive',
      timestamp: new Date(result.t).toISOString(),
    });
  } catch (error) {
    console.error('Massive.com API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock price' },
      { status: 500 }
    );
  }
}
