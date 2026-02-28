import { NextRequest, NextResponse } from 'next/server';

// POST /api/zillow/estimate
// Fetches Zestimate for a property address from Zillow via RapidAPI
export async function POST(request: NextRequest) {
  const apiKey = process.env.RAPIDAPI_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Zillow integration not configured. Set RAPIDAPI_KEY in environment.' },
      { status: 503 }
    );
  }

  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const res = await fetch(
      `https://zillow-com1.p.rapidapi.com/propertyExtendedSearch?location=${encodeURIComponent(address)}&home_type=Houses`,
      {
        headers: {
          'x-rapidapi-key': apiKey,
          'x-rapidapi-host': 'zillow-com1.p.rapidapi.com',
        },
      }
    );

    if (!res.ok) {
      throw new Error(`Zillow API error: ${res.status}`);
    }

    const data = await res.json();
    const property = data.props?.[0];

    if (!property) {
      return NextResponse.json(
        { error: 'No estimate found for this address' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      address: property.address,
      zestimate: property.zestimate ?? property.price,
      rentZestimate: property.rentZestimate,
      lastUpdated: new Date().toISOString(),
      source: 'zillow',
    });
  } catch (error) {
    console.error('Zillow API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch property estimate' },
      { status: 500 }
    );
  }
}
