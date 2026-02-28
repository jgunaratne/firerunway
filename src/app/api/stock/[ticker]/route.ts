import { NextRequest, NextResponse } from 'next/server';

// GET /api/stock/[ticker]
// Fetches current stock price from Polygon.io
export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const { ticker } = params;
  const apiKey = process.env.POLYGON_API_KEY;

  if (!apiKey) {
    // Return mock price when Polygon is not configured
    const mockPrices: Record<string, number> = {
      AMZN: 190.50,
      AAPL: 178.25,
      GOOGL: 142.80,
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
    // Polygon.io previous day close
    const res = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker.toUpperCase()}/prev?adjusted=true&apiKey=${apiKey}`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!res.ok) {
      throw new Error(`Polygon API error: ${res.status}`);
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
      source: 'polygon',
      timestamp: new Date(result.t).toISOString(),
    });
  } catch (error) {
    console.error('Polygon API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock price' },
      { status: 500 }
    );
  }
}
