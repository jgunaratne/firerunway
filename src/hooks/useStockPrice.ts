'use client';

import { useState, useEffect } from 'react';

const CACHE_KEY = 'stock_price_cache';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface CachedPrice {
  ticker: string;
  price: number;
  cachedAt: number;
}

/**
 * Fetch and cache a stock price from /api/stock/[ticker].
 * Falls back to a default price if the API is unavailable.
 */
export function useStockPrice(ticker: string, fallback = 190) {
  const [price, setPrice] = useState(fallback);

  useEffect(() => {
    if (!ticker) return;
    const key = `${CACHE_KEY}_${ticker}`;

    // Check localStorage cache
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const cached: CachedPrice = JSON.parse(raw);
        if (Date.now() - cached.cachedAt < CACHE_TTL_MS) {
          setPrice(cached.price);
          return;
        }
      }
    } catch { /* ignore */ }

    // Fetch fresh
    (async () => {
      try {
        const res = await fetch(`/api/stock/${ticker}`);
        const data = await res.json();
        if (data.price) {
          setPrice(data.price);
          try {
            localStorage.setItem(key, JSON.stringify({ ticker, price: data.price, cachedAt: Date.now() }));
          } catch { /* localStorage full */ }
        }
      } catch { /* use fallback */ }
    })();
  }, [ticker]);

  return price;
}
